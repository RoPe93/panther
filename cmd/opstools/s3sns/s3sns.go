package s3sns

/**
 * Panther is a Cloud-Native SIEM for the Modern Security Team.
 * Copyright (C) 2020 Panther Labs Inc
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import (
	"fmt"
	"log"
	"math"
	"net/url"
	"strings"
	"sync"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/lambda"
	"github.com/aws/aws-sdk-go/service/lambda/lambdaiface"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3iface"
	"github.com/aws/aws-sdk-go/service/sns"
	"github.com/aws/aws-sdk-go/service/sns/snsiface"
	jsoniter "github.com/json-iterator/go"
	"github.com/pkg/errors"
	"go.uber.org/zap"

	"github.com/panther-labs/panther/internal/core/logtypesapi"
	"github.com/panther-labs/panther/internal/log_analysis/awsglue"
	"github.com/panther-labs/panther/internal/log_analysis/notify"
	"github.com/panther-labs/panther/internal/log_analysis/pantherdb"
)

const (
	pageSize         = 1000
	topicArnTemplate = "arn:aws:sns:%s:%s:%s"
	progressNotify   = 5000 // log a line every this many to show progress
)

type Stats struct {
	NumFiles uint64
	NumBytes uint64
}

func S3Topic(sess *session.Session, account, s3path, s3region, topic string, attributes bool,
	concurrency int, limit uint64, stats *Stats) (err error) {

	return s3sns(s3.New(sess.Copy(&aws.Config{Region: &s3region})), sns.New(sess), lambda.New(sess),
		account, s3path, topic, *sess.Config.Region, attributes, concurrency, limit, stats)
}

func s3sns(s3Client s3iface.S3API, snsClient snsiface.SNSAPI, lambdaClient lambdaiface.LambdaAPI,
	account, s3path, topic, topicRegion string, attributes bool,
	concurrency int, limit uint64, stats *Stats) (failed error) {

	topicARN := fmt.Sprintf(topicArnTemplate, topicRegion, account, topic)

	errChan := make(chan error)
	notifyChan := make(chan *events.S3Event, 1000)

	var queueWg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		queueWg.Add(1)
		go func() {
			publishNotifications(snsClient, lambdaClient, topicARN, attributes, notifyChan, errChan)
			queueWg.Done()
		}()
	}

	queueWg.Add(1)
	go func() {
		listPath(s3Client, s3path, limit, notifyChan, errChan, stats)
		queueWg.Done()
	}()

	var errorWg sync.WaitGroup
	errorWg.Add(1)
	go func() {
		for err := range errChan { // return last error
			failed = err
		}
		errorWg.Done()
	}()

	queueWg.Wait()
	close(errChan)
	errorWg.Wait()

	return failed
}

// Given an s3path (e.g., s3://mybucket/myprefix) list files and send to notifyChan
func listPath(s3Client s3iface.S3API, s3path string, limit uint64,
	notifyChan chan *events.S3Event, errChan chan error, stats *Stats) {

	if limit == 0 {
		limit = math.MaxUint64
	}

	defer func() {
		close(notifyChan) // signal to reader that we are done
	}()

	parsedPath, err := url.Parse(s3path)
	if err != nil {
		errChan <- errors.Errorf("bad s3 url: %s,", err)
		return
	}

	if parsedPath.Scheme != "s3" {
		errChan <- errors.Errorf("not s3 protocol (expecting s3://): %s,", s3path)
		return
	}

	bucket := parsedPath.Host
	if bucket == "" {
		errChan <- errors.Errorf("missing bucket: %s,", s3path)
		return
	}
	var prefix string
	if len(parsedPath.Path) > 0 {
		prefix = parsedPath.Path[1:] // remove leading '/'
	}

	// list files w/pagination
	inputParams := &s3.ListObjectsV2Input{
		Bucket:  aws.String(bucket),
		Prefix:  aws.String(prefix),
		MaxKeys: aws.Int64(pageSize),
	}
	err = s3Client.ListObjectsV2Pages(inputParams, func(page *s3.ListObjectsV2Output, morePages bool) bool {
		for _, value := range page.Contents {
			if *value.Size > 0 { // we only care about objects with size
				stats.NumFiles++
				if stats.NumFiles%progressNotify == 0 {
					log.Printf("listed %d files ...", stats.NumFiles)
				}
				stats.NumBytes += (uint64)(*value.Size)
				notifyChan <- &events.S3Event{
					Records: []events.S3EventRecord{
						{
							S3: events.S3Entity{
								Bucket: events.S3Bucket{
									Name: bucket,
								},
								Object: events.S3Object{
									Key:  *value.Key,
									Size: *value.Size,
								},
							},
						},
					},
				}
				if stats.NumFiles >= limit {
					break
				}
			}
		}
		return stats.NumFiles < limit // "To stop iterating, return false from the fn function."
	})
	if err != nil {
		errChan <- err
	}
}

// post message per file as-if it was an S3 notification
func publishNotifications(snsClient snsiface.SNSAPI, lambdaClient lambdaiface.LambdaAPI,
	topicARN string, attributes bool,
	notifyChan chan *events.S3Event, errChan chan error) {

	var failed bool
	for s3Event := range notifyChan {
		if failed { // drain channel
			continue
		}

		bucket := s3Event.Records[0].S3.Bucket.Name
		key := s3Event.Records[0].S3.Object.Key
		size := s3Event.Records[0].S3.Object.Size

		zap.L().Debug("sending file to SNS",
			zap.String("bucket", bucket),
			zap.String("key", key),
			zap.Int64("size", size))

		s3Notification := notify.NewS3ObjectPutNotification(bucket, key, int(size))

		notifyJSON, err := jsoniter.MarshalToString(s3Notification)
		if err != nil {
			errChan <- errors.Wrapf(err, "failed to marshal %#v", s3Notification)
			failed = true
			continue
		}

		// Add attributes based in type of data, this will enable
		// the rules engine and datacatalog updater to receive the notifications.
		// For back-filling subscriber like Snowflake this should likely not be enabled
		var messageAttributes map[string]*sns.MessageAttributeValue
		if attributes {
			dataType, err := awsglue.DataTypeFromS3Key(key)
			if err != nil {
				errChan <- errors.Wrapf(err, "failed to get data type from %s", key)
				failed = true
				continue
			}
			logType, err := logTypeFromS3Key(lambdaClient, key)
			if err != nil {
				errChan <- errors.Wrapf(err, "failed to get log type from %s", key)
				failed = true
				continue
			}
			messageAttributes = notify.NewLogAnalysisSNSMessageAttributes(dataType, logType)
		} else {
			messageAttributes = make(map[string]*sns.MessageAttributeValue)
		}

		publishInput := &sns.PublishInput{
			Message:           &notifyJSON,
			TopicArn:          &topicARN,
			MessageAttributes: messageAttributes,
		}

		_, err = snsClient.Publish(publishInput)
		if err != nil {
			errChan <- errors.Wrapf(err, "failed to publish %#v", *publishInput)
			failed = true
			continue
		}
	}
}

// logType is not derivable from the s3 path, need to use API
var (
	initTablenameToLogType sync.Once
	tableNameToLogType     map[string]string
)

func logTypeFromS3Key(lambdaClient lambdaiface.LambdaAPI, s3key string) (logType string, err error) {
	keyParts := strings.Split(s3key, "/")
	if len(keyParts) < 2 {
		return "", errors.Errorf("logTypeFromS3Key failed parse on: %s", s3key)
	}

	initTablenameToLogType.Do(func() {
		const lambdaName, method = "panther-logtypes-api", "listAvailableLogTypes"
		var resp *lambda.InvokeOutput
		resp, err = lambdaClient.Invoke(&lambda.InvokeInput{
			FunctionName: aws.String(lambdaName),
			Payload:      []byte(fmt.Sprintf(`{ "%s": {}}`, method)),
		})
		if err != nil {
			err = errors.Wrapf(err, "failed to invoke %#v", method)
		}
		if resp.FunctionError != nil {
			err = errors.Errorf("%s: failed to invoke %#v", *resp.FunctionError, method)
		}

		var availableLogTypes logtypesapi.AvailableLogTypes
		err = jsoniter.Unmarshal(resp.Payload, &availableLogTypes)
		if err != nil {
			err = errors.Wrapf(err, "failed to unmarshal: %s", string(resp.Payload))
		}

		tableNameToLogType = make(map[string]string)
		for _, logType := range availableLogTypes.LogTypes {
			tableNameToLogType[pantherdb.TableName(logType)] = logType
		}
	})
	// catch any error from above
	if err != nil {
		return "", err
	}

	if logType, found := tableNameToLogType[keyParts[1]]; found {
		return logType, nil
	}
	return "", errors.Errorf("logTypeFromS3Key failed to find logType from: %s", s3key)
}

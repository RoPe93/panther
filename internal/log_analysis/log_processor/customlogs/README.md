# Custom log types

## Examples

#### Simple JSON object

##### Log sample

```json
{
  "method": "GET",
  "path": "/-/metrics",
  "format": "html",
  "controller": "MetricsController",
  "action": "index",
  "status": 200,
  "params": [],
  "remote_ip": "1.1.1.1",
  "user_id": null,
  "username": null,
  "ua": null,
  "queue_duration_s": null,
  "correlation_id": "c01ce2c1-d9e3-4e69-bfa3-b27e50af0268",
  "cpu_s": 0.05,
  "db_duration_s": 0,
  "view_duration_s": 0.00039,
  "duration_s": 0.0459,
  "tag": "test",
  "time": "2019-11-14T13:12:46.156Z"
}
```

##### Log schema definition

```YAML
schema: SampleAPI
fields:
- name: time
  description: Event timestamp
  required: true
  type: timestamp
  timeFormat: rfc3339
  isEventTime: true
- name: method
  description: The HTTP method used for the request
  type: string
- name: path
  description: The path used for the request
  type: string
- name: remote_ip
  description: The remote IP address the request was made from
  type: string
  indicator: ip
- name: duration_s
  description: The number of seconds the request took to complete
  type: float
- name: format
  description: Response format
  type: string
- name: user_id
  description: The id of the user that made the request
  type: string
- name: params
  type: array
  element:
    type: object
    fields:
    - name: key
      description: The name of a Query parameter
      type: string
    - name: value
      description: The value of a Query parameter
      type: string
- name: tag
  description: Tag for the request
  type: string
- name: ua
  description: UserAgent header
  type: string
```

##### Resulting panther log event

```json5
{
  duration_s: 0.0459,
  method: 'GET',
  p_any_ip_addresses: ['1.1.1.1'],
  p_event_timestamp: '2019-11-14 13:12:46.156000000',
  p_log_type: 'Custom.API',
  p_parse_timestamp: '2020-06-19 12:20:46.034959848',
  p_row_id: '507b9da5c6abad92adcae2ac0301',
  path: '/-/metrics',
  remote_ip: '1.1.1.1',
  timestamp: '2019-11-14 13:12:46.156000000',
  // ...
}
```

#### Notes

- The `time` field is used as the event timestamp and uses a 'built-in' timestamp format.
- The `remote_ip` field is marked as an `ip` indicator and is included in the result's `p_any_ip_addresses` field
- Only the defined fields are included in the output JSON

## Schema definition

### LogSchema

```YAML
schema: String # The name of the schema
version: 0 # optional field reserved for backwards compatibility in future versions
definitions: Map<string,ValueSchema> # optional index of named ValueSchema definitions to use with `ref`
fields: FieldSchema[] # A required non-empty array of FieldSchema
```

### FieldSchema

```YAML
name: String # required
required: Boolean
description: String
# includes all of the ValueSchema fields
```

### ValueSchema

`ValueSchema` describes a value in a JSON object. It's fields vary depending on `type`

```YAML
# ValueSchema fields
type: String # required (object|array|string|timestamp|int|smallint|bigint|boolean|float|ref)

# ObjectSchema fields (when type = object)
fields: FieldSchema[] # a non-empty array of FieldSchema

# ArraySchema fields (when type = array)
element: {} # ValueSchema of each array element (required when type = array)

# StringSchema fields (when type = string)
indicator: String # The indicator scanner to use for this string

# TimeSchema fields (when type = timestamp)
timeFormat: String # rfc3339|unix|unix_ms|unix_us|unix_ns
customTimeFormat: String  # a custom time format to use in strftime notation
isEventTime: Boolean # use this timestamp as the event time

# RefSchema fields (when type = ref)
ref: String # the name of a ValueSchema in the `definitions`
```

## Appendix A - Examples form native log types

### AWS.CloudTrailInsight

This event schema has nested objects and some of them are duplicated. Using the YAML doc separator and `RefSpec` values,
we can avoid schema duplication and deep YAML hierarchies.

```YAML
schema: CloudTrailInsight
fields:
- name: eventVersion
  required: true
  type: string
  description: The version of the log event format.
- name: eventTime
  required: true
  description: The date and time the request was made, in coordinated universal time (UTC).
  type: timestamp
    timeFormat: rfc3339
    isEventTime: true
- name: awsRegion
  required: true
  type: string
  description: The AWS region that the request was made to, such as us-east-2.
- name: eventId
  type: string
  required: true
  description: |
    GUID generated by CloudTrail to uniquely identify each event.
    You can use this value to identify a single event.
    For example, you can use the ID as a primary key to retrieve log data
    from a searchable database.
- name: eventType
  required: true
  type: string
  description: Identifies the type of event that generated the event record.
- name: recipientAccountId
  type: string
  indicator: aws_account_id
  description: |
    GUID generated by CloudTrail to uniquely identify each event.
    You can use this value to identify a single event.
    For example, you can use the ID as a primary key to retrieve log data from a searchable database.
- name: sharedEventId
  required: true
  type: string
  indicator: trace_id
  description: |
    A GUID that is generated by CloudTrail Insights to uniquely identify an Insights event.
    sharedEventId is common between the start and the end Insights events.
- name: insightDetails
  ref: insightDetails
  required: true
  description: |
    Shows information about the underlying triggers of an Insights event, such as event source, statistics,
    API name, and whether the event is the start or end of the Insights event
- name: eventCategory
  required: true
  type: string
  description: Shows the event category that is used in LookupEvents calls. In Insights events, the value is insight.
definitions:
  insightDetails:
    type: object
    fields:
    - name: state
      required: true
      type: string
      description: Shows whether the event represents the start or end of the insight (the start or end of unusual activity). Values are Start or End.
    - name: eventSource
      type: string
      required: true
      description: The AWS API for which unusual activity was detected.
    - name: eventName
      type: string
      description: The name of the event for which unusual activity was detected.
      required: true
    - name: insightType
      type: string
      required: true
      description: The type of Insights event. Value is ApiCallRateInsight.
    - name: insightContext
      ref: insightContext
      description: Data about the rate of calls that triggered the Insights event compared to the normal rate of calls to the subject API per minute.
  insightContext:
    type: object
    fields:
    - name: statistics
      description: |
        A container for data about the typical average rate of calls to the subject API by an account,
        the rate of calls that triggered the Insights event, and the duration, in minutes, of the Insights event.
      object:
      - name: baseline
        description: Shows the typical average rate of calls to the subject API by an account within a specific AWS Region.
        ref: insightMetric
      - name: insight
        description: Shows the unusual rate of calls to the subject API that triggers the logging of an Insights event.
        ref: insightMetric
  insightMetric:
    type: object
    fields:
    - name: average
      type: float
      description: Average value for the insight metric
      object:
      - name: average
        type: float
        description: Average value for the insight metric
    - name: insightDuration
      type: float
      description: |
        The duration, in minutes, of an Insights event (the time period from the start to the end of unusual activity on the subject API).
        insightDuration only occurs in end Insights events.
```
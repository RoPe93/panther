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
import React from 'react';
import { Link as RRLink } from 'react-router-dom';
import { Box, SimpleGrid, Text, Link, Flex, Card } from 'pouncejs';
import { formatDatetime, minutesToString, formatNumber } from 'Helpers/utils';
import Linkify from 'Components/Linkify';
import urls from 'Source/urls';
import { RuleDetails } from 'Generated/schema';
import useDetectionDestinations from 'Hooks/useDetectionDestinations';
import RelatedDestinations from 'Components/RelatedDestinations';

interface RuleCardDetailsProps {
  rule?: RuleDetails;
}

const RuleCardDetails: React.FC<RuleCardDetailsProps> = ({ rule }) => {
  const {
    detectionDestinations,
    loading: loadingDetectionDestinations,
  } = useDetectionDestinations({ rule });
  return (
    <Card as="article" p={6}>
      <Card variant="dark" as="section" p={4} mb={4}>
        <Text id="rule-description" fontStyle={!rule.description ? 'italic' : 'normal'} mb={6}>
          {rule.description || 'No description found for rule'}
        </Text>
        <SimpleGrid columns={2} spacing={5}>
          <Flex direction="column" spacing={2}>
            <Box
              color="navyblue-100"
              fontSize="small-medium"
              aria-describedby="runbook-description"
            >
              Runbook
            </Box>
            {rule.runbook ? (
              <Linkify id="runbook-description">{rule.runbook}</Linkify>
            ) : (
              <Box fontStyle="italic" color="navyblue-100" id="runbook-description">
                No runbook specified
              </Box>
            )}
          </Flex>
          <Flex direction="column" spacing={2}>
            <Box
              color="navyblue-100"
              fontSize="small-medium"
              aria-describedby="reference-description"
            >
              Reference
            </Box>
            {rule.reference ? (
              <Linkify id="reference-description">{rule.reference}</Linkify>
            ) : (
              <Box fontStyle="italic" color="navyblue-100" id="reference-description">
                No reference specified
              </Box>
            )}
          </Flex>
        </SimpleGrid>
      </Card>
      <Card variant="dark" as="section" p={4}>
        <SimpleGrid columns={2} spacing={5} fontSize="small-medium">
          <Box>
            <SimpleGrid gap={2} columns={8} spacing={2}>
              <Box gridColumn="1/3" color="navyblue-100" aria-describedby="tags-list">
                Tags
              </Box>
              {rule.tags.length > 0 ? (
                <Box id="tags-list" gridColumn="3/8">
                  {rule.tags.map((tag, index) => (
                    <Link
                      key={tag}
                      as={RRLink}
                      to={`${urls.logAnalysis.rules.list()}?page=1&tags[]=${tag}`}
                    >
                      {tag}
                      {index !== rule.tags.length - 1 ? ', ' : null}
                    </Link>
                  ))}
                </Box>
              ) : (
                <Box gridColumn="3/8" fontStyle="italic" color="navyblue-100" id="tags-list">
                  This rule has no tags
                </Box>
              )}

              <Box gridColumn="1/3" color="navyblue-100" aria-describedby="deduplication-period">
                Deduplication Period
              </Box>
              <Box gridColumn="3/8" id="deduplication-period">
                {minutesToString(rule.dedupPeriodMinutes)}
              </Box>

              <Box gridColumn="1/3" color="navyblue-100" aria-describedby="threshold">
                Threshold
              </Box>
              <Box gridColumn="3/8" id="threshold">
                {formatNumber(rule.threshold)}
              </Box>
            </SimpleGrid>
          </Box>
          <Box>
            <SimpleGrid gap={2} columns={8} spacing={2}>
              <Box color="navyblue-100" gridColumn="1/3" aria-describedby="created-at">
                Created
              </Box>
              <Box gridColumn="3/8" id="created-at">
                {formatDatetime(rule.createdAt)}
              </Box>

              <Box color="navyblue-100" gridColumn="1/3" aria-describedby="updated-at">
                Modified
              </Box>
              <Box gridColumn="3/8" id="updated-at">
                {formatDatetime(rule.lastModified)}
              </Box>

              <Box color="navyblue-100" gridColumn="1/3" aria-describedby="updated-at">
                Destinations
              </Box>
              <Box gridColumn="3/8" id="updated-at">
                <RelatedDestinations
                  destinations={detectionDestinations}
                  loading={loadingDetectionDestinations}
                  limit={5}
                  verbose
                />
              </Box>
            </SimpleGrid>
          </Box>
        </SimpleGrid>
      </Card>
    </Card>
  );
};
export default RuleCardDetails;

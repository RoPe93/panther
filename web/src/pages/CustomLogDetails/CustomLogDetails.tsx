/**
 * Copyright (C) 2020 Panther Labs Inc
 *
 * Panther Enterprise is licensed under the terms of a commercial license available from
 * Panther Labs Inc ("Panther Commercial License") by contacting contact@runpanther.com.
 * All use, distribution, and/or modification of this software, whether commercial or non-commercial,
 * falls under the Panther Commercial License to the extent it is permitted.
 */

import React from 'react';
import { Alert, Box, Button, Card, Heading, Link, SimpleGrid, Text } from 'pouncejs';
import { compose } from 'Helpers/compose';
import withSEO from 'Hoc/withSEO';
import { ErrorCodeEnum } from 'Generated/schema';
import Page404 from 'Pages/404';
import Editor from 'Components/Editor';
import Breadcrumbs from 'Components/Breadcrumbs';
import useRouter from 'Hooks/useRouter';
import useModal from 'Hooks/useModal';
import useTrackPageView from 'Hooks/useTrackPageView';
import { PageViewEnum } from 'Helpers/analytics';
import { extractErrorMessage } from 'Helpers/utils';
import TablePlaceholder from 'Components/TablePlaceholder';
import { MODALS } from 'Components/utils/Modal';
import { useGetCustomLogDetails } from './graphql/getCustomLogDetails.generated';

const CustomLogDetails: React.FC = () => {
  useTrackPageView(PageViewEnum.CustomLogDetails);

  const { showModal } = useModal();
  const { match: { params: { logType } } } = useRouter<{ logType: string }>(); // prettier-ignore

  const { data, loading, error: uncontrolledError } = useGetCustomLogDetails({
    variables: { input: { logType } },
  });

  if (loading) {
    return (
      <Card p={6}>
        <TablePlaceholder />
      </Card>
    );
  }

  if (uncontrolledError) {
    return (
      <Alert
        variant="error"
        title="Couldn't load your custom schema"
        description={extractErrorMessage(uncontrolledError)}
      />
    );
  }

  const { record: customLog, error: controlledError } = data.getCustomLog;
  if (controlledError) {
    if (controlledError.code === ErrorCodeEnum.NotFound) {
      return <Page404 />;
    }

    return (
      <Alert
        variant="error"
        title="Couldn't load your custom schema"
        description={controlledError.message}
      />
    );
  }

  return (
    <Card p={6} mb={6}>
      <Breadcrumbs.Actions>
        <Button
          variantColor="red"
          icon="delete"
          onClick={() => {
            showModal({
              modal: MODALS.DELETE_CUSTOM_LOG,
              props: { customLog },
            });
          }}
        >
          Delete Log
        </Button>
      </Breadcrumbs.Actions>

      <Heading mb={6} fontWeight="bold">
        {customLog.logType}
      </Heading>
      <Card variant="dark" as="section" p={4} mb={4}>
        <SimpleGrid columns={2}>
          <Box>
            <Box aria-describedby="description" fontSize="small-medium" color="navyblue-100" mb={2}>
              Description
            </Box>
            {customLog.description ? (
              <Text id="description">{customLog.description}</Text>
            ) : (
              <Text id="description" color="navyblue-200">
                No description found
              </Text>
            )}
          </Box>
          <Box>
            <Box
              aria-describedby="referenceURL"
              fontSize="small-medium"
              color="navyblue-100"
              mb={2}
            >
              Reference URL
            </Box>
            {customLog.referenceURL ? (
              <Link external id="referenceURL">
                {customLog.referenceURL}
              </Link>
            ) : (
              <Text id="referenceURL" color="navyblue-200">
                No reference URL provided
              </Text>
            )}
          </Box>
        </SimpleGrid>
      </Card>
      <Card variant="dark" px={4} py={5} as="section">
        <Heading size="x-small" mb={5}>
          Event Schema
        </Heading>
        <Editor readOnly width="100%" mode="yaml" value={customLog.logSpec} />
      </Card>
    </Card>
  );
};

export default compose(withSEO({ title: ({ match }) => match.params.logType }))(CustomLogDetails);

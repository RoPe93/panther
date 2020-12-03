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

/**
 * Copyright (C) 2020 Panther Labs Inc
 *
 * Panther Enterprise is licensed under the terms of a commercial license available from
 * Panther Labs Inc ("Panther Commercial License") by contacting contact@runpanther.com.
 * All use, distribution, and/or modification of this software, whether commercial or non-commercial,
 * falls under the Panther Commercial License to the extent it is permitted.
 */

import React from 'react';
import {
  buildAddCustomLogOutput,
  buildCustomLogRecord,
  fireEvent,
  render,
  waitMs,
  waitFor,
} from 'test-utils';
import urls from 'Source/urls';
import CreateCustomLog from './CreateCustomLog';
import { mockCreateCustomLog } from './graphql/createCustomLog.generated';

const customLog = buildCustomLogRecord({
  logType: 'Custom.Test',
  logSpec:
    'schema: Test\n' +
    'version: 0\n' +
    'fields:\n' +
    '  - name: method\n' +
    '    description: Test' +
    '    type: string',
});

describe('CreateCustomLog', () => {
  it('can create a custom schema', async () => {
    const mocks = [
      mockCreateCustomLog({
        variables: {
          input: {
            logType: customLog.logType,
            logSpec: customLog.logSpec,
            description: '',
            referenceURL: '',
          },
        },
        data: { addCustomLog: buildAddCustomLogOutput({ error: null, record: customLog }) },
      }),
    ];

    const { getByText, getByLabelText, getByPlaceholderText, history } = render(
      <CreateCustomLog />,
      { mocks }
    );

    fireEvent.change(getByLabelText('* Name'), { target: { value: customLog.logType } });
    fireEvent.change(getByPlaceholderText('# Write your schema in YAML here...'), {
      target: { value: customLog.logSpec },
    });
    await waitMs(210); // wait for debounce to apply the value to <Formik> + perform validation

    fireEvent.click(getByText('Save log'));
    await waitFor(() =>
      expect(history.location.pathname).toEqual(
        urls.logAnalysis.customLogs.details(customLog.logType)
      )
    );
  });

  it('can handle errors', async () => {
    const mocks = [
      mockCreateCustomLog({
        variables: {
          input: {
            logType: customLog.logType,
            logSpec: customLog.logSpec,
            description: '',
            referenceURL: '',
          },
        },
        data: {
          addCustomLog: buildAddCustomLogOutput({ error: { message: 'Test Error' }, record: null }),
        },
      }),
    ];

    const {
      getByText,
      getByLabelText,
      getByPlaceholderText,
      findByText,
    } = render(<CreateCustomLog />, { mocks });

    fireEvent.change(getByLabelText('* Name'), { target: { value: customLog.logType } });
    fireEvent.change(getByPlaceholderText('# Write your schema in YAML here...'), {
      target: { value: customLog.logSpec },
    });
    await waitMs(210); // wait for debounce to apply the value to <Formik> + perform validation

    fireEvent.click(getByText('Save log'));
    expect(await findByText(`Test Error`));
  });
});

# Panther is a Cloud-Native SIEM for the Modern Security Team.
# Copyright (C) 2020 Panther Labs Inc
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from unittest import mock, TestCase
from boto3 import Session
from ...src.app.remediations.aws_iam_update_account_password_policy import AwsIamUpdateAccountPasswordPolicy


class TestAwsIamUpdateAccountPasswordPolicy(TestCase):

    @mock.patch.object(Session, 'client')
    def test_fix(self, mock_session: mock.MagicMock) -> None:
        mock_client = mock.Mock()
        mock_session.return_value = mock_client
        parameters = {
            'MinimumPasswordLength': '10',
            'RequireSymbols': 'True',
            'RequireNumbers': 'True',
            'RequireUppercaseCharacters': 'True',
            'RequireLowercaseCharacters': 'True',
            'AllowUsersToChangePassword': 'True',
            'MaxPasswordAge': '100',
            'PasswordReusePrevention': '1000'
        }
        AwsIamUpdateAccountPasswordPolicy()._fix(Session, {}, parameters)
        mock_session.assert_called_once_with('iam')
        mock_client.update_account_password_policy.assert_called_once_with(
            MinimumPasswordLength=10,
            RequireSymbols=True,
            RequireNumbers=True,
            RequireUppercaseCharacters=True,
            RequireLowercaseCharacters=True,
            AllowUsersToChangePassword=True,
            MaxPasswordAge=100,
            PasswordReusePrevention=1000
        )

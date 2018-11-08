/*
    This file is part of Unforward.

    Unforward is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Unforward is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Unforward.  If not, see <http://www.gnu.org/licenses/>.

    Please see https://bitbucket.org/sensibill/unforward for
    more information on this project.
 */

/**
 * Created by bradley on 06/05/14.
 *
 * test_GmailClientExtractor.js
 */



var assert = require("assert"),
    async = require('async'),
    fs = require('fs'),
    examples = require('./examples'),
    GmailClientExtractor = require('../lib/email_clients/GmailClientExtractor'),
    test_common = require('./test_common');

describe("Gmail Extractor", function()
{
    this.timeout(1000);
    var gmailClient = new GmailClientExtractor();
    test_common.testMatch(gmailClient);
    test_common.testExtract(gmailClient)
});

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
 * test_YahooClientExtractor.js
 */



var assert = require("assert"),
    async = require('async'),
    fs = require('fs'),
    examples = require('./examples'),
    LotusNotesClientExtractor = require('../lib/email_clients/LotusNotesClientExtractor'),
    test_common = require('./test_common');

describe("Lotus Notes Extractor", function()
{
    this.timeout(1000);
    var lotusNotesClient = new LotusNotesClientExtractor();
    test_common.testMatch(lotusNotesClient);
    test_common.testExtract(lotusNotesClient)
});

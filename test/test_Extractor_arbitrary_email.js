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
 * test_Extractor_arbitrary_email.js
 */

var assert = require("assert"),
    async = require('async'),
    fs = require('fs'),
    examples = require('./examples'),
    path = require('path'),
    Extractor = require('../lib/Extractor');

function getUTCTime(date) {
    return date.getTime() - date.getTimezoneOffset() * 1000 * 60;
}

describe("Extractor arbitrary", function ()
{
    this.timeout(1000);

    //var arbitrary_email_file_path = "./data/examples/arbitrary_email_1.mime";
    var arbitrary_email_file_path = "./data/examples/multiforward_5.mime";
    //var arbitrary_email_file_path = "./data/examples/multiforward_americaneagle.mime";
    var type = 'mime';

    it("should correctly extract data from " + path.basename(arbitrary_email_file_path), function (next) {
        fs.readFile(arbitrary_email_file_path, {flag: 'r'}, function (err, fileData) {
            if (err) {
                return next(err);
            }

            var extractor = new Extractor();

            function testResult(err, result) {
                if (err) {
                    return next(err);
                }

                assert(result.sender);
                assert(result.date);
                //assert(result.html);

                return next();
            }

            if (type == "html") {
                extractor.extractFromHTML(fileData.toString(), testResult);
            }
            else if (type == "mime") {
                extractor.extractFromMIME(fileData.toString(), testResult);
            }
        });
    });
});

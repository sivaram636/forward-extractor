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
 * test_common.js
 */



var assert = require("assert"),
    async = require('async'),
    fs = require('fs'),
    examples = require('./examples'),
    path = require('path'),
    Extractor = require('../lib/Extractor'),
    utils = require('./common_test_utils'),
    MailParser = require('mailparser').MailParser;


module.exports.testMatch = function (client)
{
    examples.forEach(function (example)
    {
        // only do match-testing for examples with a single forward, and which are pure html examples
        if (!example.multi && example.type == "html")
        {
            it("should correctly determine if " + path.basename(example.file) + " matches", function (done)
            {
                fs.readFile(example.file, {flag: 'r'}, function (err, fileData)
                {
                    if (err)
                    {
                        return done(err);
                    }

                    var result = client.findForwardInHTML(fileData.toString());
                    if (example.client.indexOf(client.name) != -1)
                    {
                        assert.notEqual(result, -1);
                    }
                    else
                    {
                        assert.equal(result, -1);
                    }
                    return done();
                });

            });
        }
    });
};


module.exports.testExtract = function (client)
{
    examples.forEach(function (example)
    {
        function checkResult (htmlString, done)
        {
            var result = client.extractFromHTML(htmlString.toString());

            assert.equal(result.sender, example.result.sender);
            assert.equal(result.senderName, example.result.senderName);
            assert.equal(result.date.getTime(), utils.getUTCTime(example.result.date));
            assert.equal(utils.reduceHTMLWhitespace(result.html), utils.reduceHTMLWhitespace(example.result.html));

            return done();
        }

        // skip error files
        if (example.result === Error)
        {
            return;
        }

        // only do match-testing for examples with a single forward, and which are pure html examples
        if (example.type == "html" && !example.multi && client.name == example.client[0])
        {
            it("should be able to extract the data from " + path.basename(example.file) + " correctly. ", function (done)
            {
                fs.readFile(example.file, {flag: 'r'}, function (err, fileData)
                {
                    if (err)
                    {
                        return done(err);
                    }
                    checkResult(fileData.toString(), done);
                });
            });
        }
        else if (example.type == "mime" && !example.multi && client.name == example.client[0])
        {
            it("should be able to extract the data from " + path.basename(example.file) + " correctly. ", function (done)
            {
                fs.readFile(example.file, {flag: 'r'}, function (err, fileData)
                {
                    if (err)
                    {
                        return done(err);
                    }

                    var self = this;
                    var options = {normalizeWhitespace: false};
                    var mailparser = new MailParser(options);

                    mailparser.on("end", function (mail)
                    {
                        if (!mail.html)
                        {
                            mail.html = "";
                        }

                        checkResult(mail.html, done);
                    });

                    mailparser.write(fileData.toString());
                    mailparser.end();
                });
            });
        }
    });
};

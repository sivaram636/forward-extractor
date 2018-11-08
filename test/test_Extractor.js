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
 * test_Extractor.js
 */



var assert = require("assert"),
    async = require('async'),
    fs = require('fs'),
    examples = require('./examples'),
    path = require('path'),
    Extractor = require('../lib/Extractor'),
    utils = require('./common_test_utils'),
    errors = require("../lib/Errors");


function extractResult(extractor, data, callback, exampleType)
{
    if (exampleType === "html")
    {
        extractor.extractFromHTML(data, callback);
    }
    else if (exampleType === "mime")
    {
        extractor.extractFromMIME(data, callback);
    }
}

describe("Extractor", function ()
{
    var extractor = new Extractor();

    this.timeout(1000);
    examples.forEach(function (example)
    {
        if (example.result === Error)
        {
            it("should throw error because malformed email in " + path.basename(example.file), function (next)
            {
                fs.readFile(example.file, {flag: 'r'}, function (err, fileData)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    function testResult (err, result, debugInfo)
                    {
                        assert.notEqual(err, null);

                        return next();
                    }

                    extractResult(extractor, fileData.toString(), testResult, example.type);

                });
            });
        }
        else
        {
            it("should correctly extract data from " + path.basename(example.file), function (next)
            {
                fs.readFile(example.file, {flag: 'r'}, function (err, fileData)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    function testResult (err, result, debugInfo)
                    {
                        if (err)
                        {
                            return next(err);
                        }

                        try
                        {
                            assert(result.sender);
                            assert(result.date);
                            assert.equal(result.sender, example.result.sender, "Incorrect sender.");
                            assert.equal(result.senderName, example.result.senderName, "Incorrect senderName.");
                            var expectedDate = example.result.date;//getESTTime(example.result.date);
                            var resultDate = utils.getLocalTime(result.date);
                            //console.log(new Date().getTimezoneOffset() + " " + resultDate + " !!! " + expectedDate + " !!! " + example.result.date + "\n");
                            assert.equal(resultDate.getYear(), expectedDate.getYear());
                            assert.equal(resultDate.getMonth(), expectedDate.getMonth());
                            assert.equal(resultDate.getDay(), expectedDate.getDay());
                            assert.equal(resultDate.getDate(), expectedDate.getDate());

                            if (example.result.html != undefined)
                            {
                                assert(result.html);
                                assert.equal(utils.reduceHTMLWhitespace(result.html), utils.reduceHTMLWhitespace(example.result.html));
                            }
                            if (example.result.text != undefined)
                            {
                                assert(result.text);
                                assert.equal(result.text.replace(/\s+/g, ""), example.result.text.replace(/\s+/g, ""));
                            }

                        }
                        catch(e)
                        {
                            console.log(JSON.stringify(debugInfo, null, 2));
                            console.log(JSON.stringify(result, null, 2));
                            throw e;
                        }

                        return next();
                    }

                    extractResult(extractor, fileData.toString(), testResult, example.type);
                });
            });
        }
    });
});

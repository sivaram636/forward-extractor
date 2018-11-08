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


var Extractor = require('./Extractor');
var errors = require("./Errors");

function unforward (raw_email, mode, next)
{
    var extractor = new Extractor();

    function handleResult (err, result, debug)
    {
        if (err)
        {
            if (err instanceof errors.NoForwardFound)
            {
                return next("noforwardfound", null, debug);
            }
            else if (err instanceof errors.ExtractionError)
            {
                return next("failed", null, debug);
            }
            else if (err instanceof errors.NoHTMLPayloadFoundError)
            {
                return next("nohtmlpayloadfound", null, debug);
            }
            else
            {
                console.log("--unforward-- unknown internal error:", err, "--unforward--");
                if(result && result._id)
                {
                    console.log("result._id:", result._id);
                }
                return next("failed", null, debug);
            }
        }
        else
        {
            return next(null, result, debug);
        }
    }

    try
    {
        if (mode == "html")
        {
            extractor.extractFromHTML(raw_email, handleResult);
        }
        else if (mode == "text")
        {
            extractor.extractFromRawText(raw_email, handleResult);
        }
    }
    catch (err)
    {
        handleResult(err, null, {message: "top level exception (BAD! this shouldn't happen)", exception: err.toString(), error: err, stack:err.stack.split("\n")});
    }
}

module.exports = unforward;



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
 */

var UnforwardErrorBase = function UnforwardErrorBase (message)
{
    Error.call(this, message);
    Error.captureStackTrace(this, arguments.callee);
};
UnforwardErrorBase.prototype = Error.prototype;
module.exports.UnforwardErrorBase = UnforwardErrorBase;


// Unforward did not find any forwards within the email
var NoForwardFound = function NoForwardFound ()
{
    UnforwardErrorBase.call(this, "No forwarding functionality found");
};
NoForwardFound.prototype = UnforwardErrorBase.prototype;
module.exports.NoForwardFound = NoForwardFound;


// Extraction Error
var ExtractionError = function ExtractionError (message)
{
    this.message = message;
    UnforwardErrorBase.call(this, message);
};
ExtractionError.prototype = UnforwardErrorBase.prototype;
module.exports.ExtractionError = ExtractionError;


// NoHTMLPayloadFound
var NoHTMLPayloadFoundError = function NoHTMLPayloadFoundError ()
{
    UnforwardErrorBase.call(this, "No HTML Payload Found.");
};
NoHTMLPayloadFoundError.prototype = UnforwardErrorBase.prototype;
module.exports.NoHTMLPayloadFoundError = NoHTMLPayloadFoundError;

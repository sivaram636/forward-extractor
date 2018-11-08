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

/*
 * EmailClientExtractorBase.js
 *
 */

var namedRegex = require('named-regexp').named;
var strptime = require('micro-strptime').strptime;


function EmailClientExtractorBase ()
{

}


EmailClientExtractorBase.prototype.extractFromHTML = function ()
{

};


EmailClientExtractorBase.prototype.findForwardInHTML = function ()
{

};


EmailClientExtractorBase.prototype.findForwardInRawText = function (text)
{

};


// This is a special case to extract this date format. Strptime had some trouble
// with formats that include timezones.
EmailClientExtractorBase.prototype.extractDateFromTextSpecialCase = function (text)
{
    function getHours (matches) {
        const amPm = matches[9];
        const rawHour = parseInt(matches[5]);
        var hoursToAdd = 0;
        if (amPm === "PM" && rawHour < 12)
        {
            hoursToAdd = 12;
        }
        return hoursToAdd + rawHour;
    }

    var formattedDate;

    // Date format is: June 3, 2014 at 1:47:52 PM EDT
    var dateRegex = /(\w+)\s(\d+),\s(\d+)\s(at\s)*(\d+):(\d+)(:(\d+)\s*)?(\w*).*$/m;
    var dateMatch = namedRegex(dateRegex);
    var matches = dateMatch.exec(text);
    if (matches)
    {
        formattedDate = matches[1] + " " + matches[2] + ", " + matches[3] + " " + getHours(matches) + ":" + matches[6] + ":" + matches[8];
        return strptime(formattedDate, "%B %d, %Y %H:%M:%S");
    }

    // Date format is: 25 October 2016 at 9:55:30 am BST
    dateRegex = /(\d+)\s(\w+)\s(\d+)\s(at\s)*(\d+):(\d+):(\d+)\s(\w+).*$/m;
    dateMatch = namedRegex(dateRegex);
    matches = dateMatch.exec(text);
    if (matches)
    {
        formattedDate = matches[1] + " " + matches[2] + ", " + matches[3] + " " + getHours(matches) + ":" + matches[5] + ":" + matches[6];
        return strptime(formattedDate, "%d %B, %Y %H:%M:%S");
    }

    return null;
};


EmailClientExtractorBase.prototype.extractDateFromText = function (text)
{
    for (var regexN = 0; regexN < this.dateRegexes.length; regexN += 1)
    {
        var dateRegex = this.dateRegexes[regexN];
        var dateMatch = namedRegex(dateRegex);

        var matches = dateMatch.exec(text);
        if (matches)
        {
            if (matches.captures.date)
            {
                var dateString = matches.captures.date.toString().trim();
                for (var n = 0; n < this.dateFormats.length; n += 1)
                {
                    var dateFormat = this.dateFormats[n];

                    try
                    {
                        //console.log(dateString, dateFormat);
                        return strptime(dateString, dateFormat);
                    }
                    catch (err)
                    {
                        // console.log(err);
                        // do nothing.
                    }
                }
            }
        }
    }

    // All else fails, try the special case
    return this.extractDateFromTextSpecialCase(text);
};

EmailClientExtractorBase.prototype.extractDateStringFromText = function (text)
{
    var self = this;
    var extractedDate = null;

    function extractDateSync() {
        return new Promise(function (resolve, reject) {
            for (var regexN = 0; regexN < self.dateRegexes.length; regexN += 1)
            {
                var dateRegex = self.dateRegexes[regexN];
                var dateMatch = namedRegex(dateRegex);
                var matches = dateMatch.exec(text);
                if (matches)
                {
                    if (matches.captures.date)
                    {
                        var dateString = matches.captures.date.toString().trim();
                        dateString = dateString.split("\n")[0];
                        extractedDate = dateString;
                        resolve(dateString);
                    }
                }
            }
        });
    }
    extractDateSync().then(dateExtraction =>
    {
        extractedDate = dateExtraction;
    })
    return extractedDate;
};


EmailClientExtractorBase.prototype.extractSenderFromText = function (text)
{
    var self = this;
    var extractedFromString = "TEST";
    function extractTextSync()
    {
       return new Promise(function (resolve, reject) {
           var extractedText = null;
            for (var regexN = 0; regexN < self.senderRegexes.length; regexN += 1)
            {
                var senderRegex = self.senderRegexes[regexN];
                var senderMatch = namedRegex(senderRegex);

                var matches = senderMatch.exec(text);
                if (matches)
                {
                    if (matches.captures.from)
                    {
                        var fromString = matches.captures.from.toString().trim();
                        extractedText = fromString;
                        break;
                    }
                }
            }
            if(extractedText)
            {
                extractedFromString = extractedText;
                resolve(extractedText);
            }
            else {
                extractedFromString = null;
                resolve(extractedText);
            }
        });
    }
    extractTextSync().then(function(processedText)
    {

    })
    return extractedFromString;

};

EmailClientExtractorBase.prototype.extractSenderNameFromText = function (text)
{
    for (var regexN = 0; regexN < this.senderRegexes.length; regexN += 1)
    {
        var senderRegex = this.senderRegexes[regexN];
        var senderMatch = namedRegex(senderRegex);

        var matches = senderMatch.exec(text);
        if (matches)
        {
            if (matches.captures.name && matches.captures.from)
            {
                var senderName = matches.captures.name.toString().trim();
                if (senderName.length > 0)
                {
                    // some of the clients have quotes surrounding the name, try locating and removing
                    var firstQuoteIndex = senderName.indexOf("\"");
                    var lastQuoteIndex = senderName.lastIndexOf("\"");
                    if (firstQuoteIndex != -1 && lastQuoteIndex != -1 && firstQuoteIndex != lastQuoteIndex)
                    {
                        senderName = senderName.substring(firstQuoteIndex + 1, lastQuoteIndex);
                    }
                    return senderName;
                }
            }
        }
    }
    return null;
};

EmailClientExtractorBase.prototype.extractDestinationFromText = function (text)
{
    for (var regexN = 0; regexN < this.destinationRegexes.length; regexN += 1)
    {
        var destinationRegex = this.destinationRegexes[regexN];
        var destinationMatch = namedRegex(destinationRegex);

        var matches = destinationMatch.exec(text);
        if (matches)
        {
            if (matches.captures.to)
            {
                var toString = matches.captures.to.toString();
                var commaPos = toString.lastIndexOf(",");
                if (commaPos != -1)
                {
                    return toString.substr(commaPos + 1).trim();
                }

                return toString.trim();
            }
        }
    }
    return null;
};

EmailClientExtractorBase.prototype.extractBodyFromText = function (text)
{
    var lastMimeHeaderText = this.getLastMimeHeaderText(text);
    var lastMimeHeaderLineRegex = new RegExp(lastMimeHeaderText + ".+");

    var test = text.split(lastMimeHeaderLineRegex.exec(text));
    var finalString = "";
    for(var index = 1; index < test.length; index++)
    {
        finalString += test[index]
    }
    return finalString;
};

EmailClientExtractorBase.prototype.getLastMimeHeaderText = function (emailString)
{
    var lastMimeHeaderText = null;
    var largestIndex = 0;
    var htmlOneString = emailString.replace(/\n/g, '');
    var index = htmlOneString.indexOf('From:');
    if (index > -1)
    {
        largestIndex = index;
        lastMimeHeaderText = "From:"
    }
    index = htmlOneString.indexOf('Subject:');
    if (index > largestIndex)
    {
        largestIndex = index;
        lastMimeHeaderText = "Subject:"
    }
    index = htmlOneString.indexOf('Date:');
    if (index > largestIndex)
    {
        largestIndex = index;
        lastMimeHeaderText = "Date:"
    }
    index = htmlOneString.indexOf('To:');
    if (index > largestIndex)
    {
        largestIndex = index;
        lastMimeHeaderText = "To:"
    }
    index = htmlOneString.indexOf('Reply-To:');
    if (index > largestIndex)
    {
        largestIndex = index;
        lastMimeHeaderText = "Reply-To:"
    }
    return lastMimeHeaderText;
};

EmailClientExtractorBase.prototype.isMimeHeaderText = function (text)
{
    var mimeHeaderText = [
        "From:",
        "Subject:",
        "To:",
        "Date:",
        "Cc:",
        "Reply-To:"
    ]
    for (var i = 0; i < mimeHeaderText.length; i++)
    {
        var index = text.indexOf(mimeHeaderText[i]);
        if (index > -1)
        {
            return true;
        }
    }
    return false;
};


EmailClientExtractorBase.prototype.extractFromRawText = function (text)
{
    return {
        text:           this.extractBodyFromText(text),
        sender:         this.extractSenderFromText(text),
        senderName:     this.extractSenderNameFromText(text),
        date:           this.extractDateFromText(text)
    };
};

module.exports = EmailClientExtractorBase;

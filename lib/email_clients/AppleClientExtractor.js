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
 * AppleClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var namedRegex = require('named-regexp').named;

function AppleClientExtractor ()
{
    this.name = "apple";
    this.dateFormats = [];
    this.dateRegexes = [
        /Date:\s*(:<date>.*\sat\s.*)To:/m,
        /Date:\s*(:<date>.*\sat\s.*)/m
        //Date: June 3, 2014 at 3:37:42 PM EDT
    ];
    this.senderRegexes = [
        /From:\s*(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>Date:/m,
        /From:\s*(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>$/m,
        /From:\s*(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>.*$/m,
        /.*From:\s*(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>Date:/m,
        /.*From:\s*(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>$/m,
        /.*From:\s*(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)>.*$/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)Date:/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)$/m
    ];
    this.bodyRegexes = [];
    this.destinationRegexes = [];

    EmailClientExtractorBase.call(this);
}

AppleClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);
    var quote_container = $('blockquote');
    if (quote_container.length == 0)
    {
        throw new errors.ExtractionError("Parsing of Apple/Mac email forward failed. No blockquote tag was found.");
    }

    var sender, senderName, body, date, result;

    var sender = this.extractSender(quote_container);
    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderName(quote_container);

    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDate(quote_container);

    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    body = this.extractBody(quote_container);

    if (body == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
    }

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};

AppleClientExtractor.prototype.extractDate = function (headerDivNode)
{
    var child = null;
    var date_string = null;
    try
    {
        // the following works for apple desktop mail client
        date_string = headerDivNode[0].children[2].children[1].children[0].data;
        var date = this.extractDateFromTextSpecialCase(date_string);
        if (date != null)
        {
            return date;
        }
        if (date_string !== undefined) {
            date = this.extractDateFromTextSpecialCase2(date_string);
            if (date != null)
            {
                return date;
            }
        }

        // try a second method
        date_string = headerDivNode[0].children[1].children[1].children[0].data;
        var date = this.extractDateFromTextSpecialCase(date_string);
        if (date != null)
        {
            return date;
        }
        else
        {
            // try another date format
            return this.extractDateFromTextSpecialCase2(date_string);
        }
    }
    catch (err)
    {
        // if we get an exception, the dom may have changed.
        // try to use a more generic approach
        var headerText = headerDivNode.text();
        date_string = this.extractDateStringFromText(headerText);
        return this.extractDateFromTextSpecialCase(date_string);
    }
    return null;
};

// This is a special case to extract this date format. Strptime had some trouble
// with formats that include timezones.
AppleClientExtractor.prototype.extractDateFromTextSpecialCase2 = function (text)
{
    // format is: "11 April, 2013 6:17:59 PM EDT"
    var dateRegex = /(\d+)\s(\w+),\s(\d+)\s(\d+):(\d+):(\d+)\s(\w+)\s.*$/m;
    var dateMatch = namedRegex(dateRegex);
    var matches = dateMatch.exec(text);
    if (matches)
    {
        var am_pm = matches[7];
        var rawHour = parseInt(matches[4]);
        var hours_to_add = 0;
        if (am_pm === "PM" && rawHour < 12)
        {
            hours_to_add = 12;
        }
        var hour = parseInt(hours_to_add) + parseInt(matches[4]);
        var dateString2 = matches[2] + " " + matches[1] + ", " + matches[3] + " " + hour + ":" + matches[5] + ":" + matches[6];
        return strptime(dateString2, "%B %d, %Y %H:%M:%S");
    }

    return null;
};

AppleClientExtractor.prototype.extractSender = function (headerDivNode)
{
    // Since the sender email is always found in the same block or the one right after the 'from' tag, we can search
    // for the 'from' tag and return the first email that is after it.
    var child = null;
    try
    {
        var fromFound = false;
        var children = headerDivNode[0].children;
        for (var i = 0; i < children.length; ++i)
        {
            child = $(children[i]);
            if (!fromFound)
            {
                if (child.html().match(/<b( class=".*")?>From:/g))
                {
                    fromFound = true;
                }
            }

            if (fromFound)
            {
                var emailRegex = /.*?mailto:([A-Z0-9_%+-]+(\.[A-Z0-9_%+-]+)*@([A-Z0-9-]+\.)+[A-Z]{2,32})/i;
                var sender = child.html().match(emailRegex);
                if (sender)
                {
                    return sender[1];
                }
            }
        }
    }
    catch (err)
    {
        // if we get an exception, the dom may have changed.
        // try to use a more generic approach
        var headerText = headerDivNode.text();
        return this.extractSenderFromText(headerText);
    }
    return null;
};

AppleClientExtractor.prototype.extractSenderName = function (headerDivNode)
{
    var child = null;
    try
    {
        // the following works for apple desktop mail client
        // find data in the second span
        var children = headerDivNode[0].children[0].children[1].children;
        var senderRegex = /(:<sender>.+)\s*/m; // this may allow too much in...
        var senderMatch = namedRegex(senderRegex);

        for (i = 0; i < children.length; i++) {
            child = children[i];
            if (child.data && child.data.length > 0)
            {
                var matches = senderMatch.exec(child.data.toString().trim());
                if (matches)
                {
                    if (matches.captures.sender)
                    {
                        // removing the '<' html name from string, may need to
                        var senderName = matches.captures.sender.toString().replace("&lt;"," ");
                        return senderName.trim();
                    }
                }
            }
        }
        // if we reach here, try a second method
        children = headerDivNode[0].children[0].children[0].children[1].children;
        for (i = 0; i < children.length; i++) {
            child = children[i];
            // sender text
            return child.children[0].data.toString().trim();
        }
    }
    catch (err)
    {
        // if we get an exception, the dom may have changed.
        // try to use a more generic approach
        var headerText = headerDivNode.text();
        return this.extractSenderNameFromText(headerText);
    }
    return null;
};

AppleClientExtractor.prototype.extractBody = function (quote_container)
{
    var body = quote_container.find('div[dir="ltr"]').html();

    // if body is null, then try a second method to get the body
    if (body == null)
    {
        if(quote_container.length > 2)
        {
            if(quote_container[0].hasOwnProperty('parent') && quote_container[0].parent)
            {
                if(quote_container[0].parent.hasOwnProperty('parent') && quote_container[0].parent.parent)
                {
                    body = this.extractBodyAfterAppleInterchangeNewline(quote_container[0].parent.parent);
                }
                else
                {
                    body = this.extractBodyAfterAppleInterchangeNewline(quote_container[0].parent);
                }
            }
        }

        else
        {
            body = this.extractBodyAfterForwardHeaders(quote_container[0]);
        }
        if (!body) {
            body = this.extractBodyFromBlockquoteParent(quote_container);

            if (!body) {
                // workaround for bug in cheerio: normally we pass in quote_container.children()
                // but cheerio doesn't include the text nodes in children() so we need to
                // pass quote_container and extract the child nodes manually
                return this.extractBodyFromBlockquote(quote_container);
            }
        }
    }
    return body;
};

AppleClientExtractor.prototype.extractBodyFromBlockquote = function (quote_container)
{
    //var child = null;
    // create an empty container for the body nodes
    var body_clone = $(quote_container[0]).clone();
    body_clone.empty();

    // iterate over nodes, and skip over divs that contain From, Subject, To, Date, Cc, Reply-To
    var j = 0;
    var children = quote_container[0].children;
    for (var i = 0; i < children.length; i++)
    {
        var isMimeHeaderDiv = this.isMimeHeaderDiv(children[i]);
        if (!isMimeHeaderDiv)
        {
            body_clone[0].children[j++] = children[i];
        }
    }

    return body_clone.html();
};

AppleClientExtractor.prototype.extractBodyAfterAppleInterchangeNewline = function (container)
{
    var body_clone = $(container).clone();
    body_clone.empty();

    // copy all nodes after the special apple node
    var j = 0;
    var isStartNodeFound = false;

    var children = container.children;
    for (var i = 0; i < children.length; i++)
    {
        var child = $(children[i]);
        if(isStartNodeFound)
        {
            if(body_clone.html() || (!body_clone.html() && child.html()))
            {
                body_clone[0].children[j++] = children[i];
            }
            else if(body_clone.html() || (!body_clone.html() && child.text()))
            {
                body_clone[0].children[j++] = children[i];
            }

        }
        if (!isStartNodeFound)
        {
            if (child.html() && child.html().match(/Begin forwarded message:/g))
            {
                isStartNodeFound = true;
            }
        }
    }

    return body_clone.html();
};

AppleClientExtractor.prototype.extractBodyAfterForwardHeaders = function (container)
{
    // Unforwards the email once. Adds things one-by-one to the response container (body_clone), deleting when it
    // encounters a line of the header (we cannot just delete when we see the date and to lines since the order in which
    // the headers appears does not seem to follow a strict pattern and not all headers appear all the time).

    // Creates a clone of the original body so that the original container is not mutated
    var body_clone = $(container).clone();
    body_clone.empty();

    // j is the child number, alreadyUnforwarded tells us whether one forward has already been removed, in which case
    // the rest of the email should simply be copied.
    var j = 0;
    var alreadyUnforwarded = false;

    var children = container.children;
    for (var i = 0; i < children.length; i++)
    {
        var child = $(children[i]);
        if (child.html())
        {
            if (alreadyUnforwarded)
            {
                body_clone[0].children[j++] = children[i];
            }
            else if (child.html().match(/<b( class=.*)??>Subject:.*?<\/b>/g) ||
                child.html().match(/<b( class=.*)??>Reply-To:.*?<\/b>/g) ||
                child.html().match(/<b( class=.*)??>To:.*?<\/b>/g) ||
                child.html().match(/<b( class=.*)??>From:.*?<\/b>/g) ||
                child.html().match(/<b( class=.*)??>Date:.*?<\/b>/g))
            {
                if (child.html().match(/Begin forwarded message:/))
                {
                    // The nested forwards are all in one block, so if we were to delete the block because it had 'from'
                    // in it, we would delete the rest of the email.
                    alreadyUnforwarded = true;
                    body_clone[0].children[j++] = children[i];
                }
                else
                {
                    body_clone.empty();

                    // Skip copying the element after the header tag (the recipient after the 'from' tag, for example).
                    ++i;
                    j = 0;
                }
            }
            else
            {
                body_clone[0].children[j++] = children[i];
            }
        }
        else if (body_clone.html() || child.text())
        {
                body_clone[0].children[j++] = children[i];
        }
    }
    return body_clone.html();
};

AppleClientExtractor.prototype.extractBodyFromBlockquoteParent = function (quote_container)
{
    var children = null;
    if(quote_container[0])
    {
        children = quote_container[0].children;
    }
    if(children)
    {
        return null;
    }

    var fromNodeResult = this.findFromNode(children);
    if (!fromNodeResult.isMatchFound)
    {
        // no match found
        return null;
    }


    var body_clone = $(quote_container[0].parent.parent).clone();

    body_clone.empty();

    // iterate over nodes, and skip over divs that contain From, Subject, To, Date, Cc, Reply-To
    var j = 0;
    var children = quote_container[0].parent.parent.children;
    var start = null;
    for (var i = 0; i < children.length; i++)
    {
        if(children[i] === quote_container[0].parent)
        {
            start = i + 1;
            break;
        }
    }

    for (var i = start; i < children.length; i++)
    {
        body_clone[0].children[j++] = children[i];
    }

    return body_clone.html();
};

AppleClientExtractor.prototype.findParentDiv = function (fromNode)
{
    var node = fromNode.parent;
    var parentFound = false;

    if(!node)
    {
        return null;
    }
    while (!parentFound)
    {
        if (node.type === "tag" && node.name === "div")
        {
            parentFound = true;
            return node;
        }
        else
        {
            node = node.parent;
            if(node == null)
            {
                parentFound = true;
                return null;
            }
        }
    }
};

AppleClientExtractor.prototype.findFromNode = function (children)
{
    var isMatchFound = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        // check for end condition
        if (child.type === "text" && child.data.match(/From:/g))
        {
            // From node found
            return {isMatchFound: true, node: child};
        }
        else if (child.children !== undefined && child.children.length > 0)
        {
            // make recursive call
            var result = this.findFromNode(child.children);
            if (result.isMatchFound) {
                return result;
            }
        }
    }
    if (!isMatchFound)
    {
        return {isMatchFound: false, node: null};
    }
};

AppleClientExtractor.prototype.findContainerDiv = function (rootNode)
{
    var lastMimeHeaderText = this.getLastMimeHeaderText(rootNode.text());

    // find the first text node that has "From:"
    var fromNodeResult = this.findFromNode(rootNode[0].children);
    if (!fromNodeResult.isMatchFound)
    {
        // no match found
        return null;
    }
    var fromNode = fromNodeResult.node;
    // find the first parent node that is a <div>
    var parentDiv = this.findParentDiv(fromNode);
    var parentNode = $(parentDiv);

    if(parentDiv == null)
    {
        var parentDiv = this.findGenericParentTag(fromNode);
        var parentNode = $(parentDiv);

        if(parentDiv == null)
        {
            return null;
        }
    }

    var isContainerDivFound = false;

    while (!isContainerDivFound)
    {
        // check if the parent div contains the last mime header text
        var testLastMimeHeaderText = this.getLastMimeHeaderText(parentNode.text());
        if (lastMimeHeaderText === testLastMimeHeaderText)
        {
            isContainerDivFound = true;
            return parentNode;
        }
        else
        {
            parentDiv = this.findParentDiv(parentNode[0]);
            parentNode = $(parentDiv);
        }
    }
}

AppleClientExtractor.prototype.isMimeHeaderDiv = function (node)
{
    try
    {
        var mimeHeaderText = node.children[0].children[0].children[0].data.trim();
        if (mimeHeaderText === "From:" ||
            mimeHeaderText === "Subject:" ||
            mimeHeaderText === "To:" ||
            mimeHeaderText === "Date:" ||
            mimeHeaderText === "Cc:" ||
            mimeHeaderText === "Reply-To:"
            )
        {
            return true;
        }
        // if we reach here, try second method
        mimeHeaderText = node.children[0].children[0].children[0].children[0].data.trim();
        if (mimeHeaderText === "From:" ||
            mimeHeaderText === "Subject:" ||
            mimeHeaderText === "To:" ||
            mimeHeaderText === "Date:" ||
            mimeHeaderText === "Cc:" ||
            mimeHeaderText === "Reply-To:"
            )
        {
            return true;
        }
    }
    catch (err)
    {
        // if we reach here, try second method
        try
        {
            var mimeHeaderText = node.children[0].children[0].children[0].children[0].data.trim();
            if (mimeHeaderText === "From:" ||
                mimeHeaderText === "Subject:" ||
                mimeHeaderText === "To:" ||
                mimeHeaderText === "Date:" ||
                mimeHeaderText === "Cc:" ||
                mimeHeaderText === "Reply-To:"
                )
            {
                return true;
            }
        }
        catch (err)
        {
            try
            {
                var mimeHeaderText = node.children[1].children[0].children[0].data.trim();
                if (mimeHeaderText === "From:" ||
                    mimeHeaderText === "Subject:" ||
                    mimeHeaderText === "To:" ||
                    mimeHeaderText === "Date:" ||
                    mimeHeaderText === "Cc:" ||
                    mimeHeaderText === "Reply-To:"
                    )
                {
                    return true;
                }
            }
            catch (err)
            {
                return false;
            }
        }
        return false;
    }
    return false;
};

AppleClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // check if we have a unique string that only an apple mail client would have
    var index = htmlstring.regexIndexOf(/<(br class=(3D)?"")|(div( class=(3D)?"")?)>Begin forwarded message:/);
    if (index != -1)
    {
        index = htmlstring.indexOf("Begin forwarded message:");
    }

    return index;
};

AppleClientExtractor.prototype.findForwardInRawText = function (htmlstring, iphoneclientfound)
{
    // If we found already an iPhone we skip Apple
    if (iphoneclientfound)
    {
        return -1;
    }

    if (htmlstring === undefined || htmlstring === null) {
        return -1;
    }
    return htmlstring.regexIndexOf(/Begin forwarded message:/m)
};

AppleClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = AppleClientExtractor;

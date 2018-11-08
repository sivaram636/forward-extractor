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
 * GenericClientExtractor.js
 *
 */

var EmailClientExtractorBase = require('./EmailClientExtractorBase');
var cheerio = require("cheerio");
var errors = require("../Errors");
var strptime = require('micro-strptime').strptime;
var render = require("cheerio/lib/render");
var namedRegex = require('named-regexp').named;
var async = require('async')

function GenericClientExtractor ()
{
    this.name = "generic";
    this.body_method = "";
    this.dateFormats = ["%Y, %B, %d %H:%M %p",
                        "%A, %d %B %Y %H:%M:%S %Z",
                        "%B, %d, %Y at %H:%M:%S %p %Z",
                        "%B %d, %Y at %H:%M:%S %Z",
                        "%B %d, %Y at %H:%M:%S",
                        "%B %d, %Y %H:%M %p",
                        "%B %d, %Y %H:%M",
                        "%B %d, %Y, %H:%M",
                        "%A, %B %d, %Y at %H:%M %p",
                        "%A, %B %d, %Y",
                        "%A, %d %B %Y",
                        "%A, %B %d, %Y %H:%M",
                        "%A, %B %d, %Y %H:%M %p",
                        "%d %B %Y %H:%M:%S %Z",
                        "%d %B %Y %H:%M:%S",
                        "%Y-%B-%d %H:%M:%S %Z",
                        "%Y-%m-%d %H:%M:%S %Z",
                        "%Y-%m-%d %H:%M:%S %p",
                        "%Y-%m-%d %H:%M %Z",
                        "%Y-%m-%d %H:%M %p",
                        "%Y-%m-%d %H:%M",
                        "%A %B %d %Y",
                        "%A, %B %d %Y",
                        "%d %B %Y %H:%M"];

    this.dateRegexes = [
        /(?:Date|Sent):\s*(:<date>.*)Subject/m,
        /(?:Date|Sent):\s*(:<date>.*)To:/m,
        /(?:Date|Sent):\s*(:<date>[a-zA-Z]* [ at,:0-9]* ([A-Z]{3}))/m,
        /(?:Date|Sent):\s*(:<date>[a-zA-Z]* [ at,:0-9]*)/m,
        /(?:Date|Sent):\s*(:<date>[a-zA-Z0-9 :+,-]*)/m,
        /(?:Date|Sent):\s*<\/\w+>(:<date>[a-zA-Z0-9 :+,-]*)/m,
        /(?:Date|Sent):\s*(:<date>.*)$/m,
        /(?:Date|Sent):\s*[^a-zA-Z0-9:+,-](:<date>[a-zA-Z0-9 :+,-]*)\s*$/m,
        /(?:Date|Sent):.*(:<date>[0-9 :+,-]+)[^0-9 :+,-]</m,
        /(?:Date|Sent):.*>(:<date>[a-zA-Z0-9 :+,-]+)</m
    ];
    this.senderRegexes = [
        /^From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>.*$/m,
        /^.*From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>.*$/m,
        /^From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>To.*$/m,
        /^.*From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>Date.*$/m,
        /^From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.)+?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>Subject.*$/m,
        /^.*From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>Subject.*$/m,
        /^.*From:(:<name>[^<]*)<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>[^a-zA-Z0-9-.]$/m,
        /From:(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})To.*$/m,
        /From:(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})Date.*$/m,
        /From:(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})Subject/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})To.*$/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})Date.*$/m,
        /From:\s*(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})Subject.*/m,
        /From:<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>$/m,
        /From:[\s\w]*<(:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})>/m,
        /From:[^\s]*[^a-zA-Z0-9_.+-](:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})[^a-zA-Z0-9_.+-]/m,
        /From:[^\s]*[^a-zA-Z0-9_.+-](:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})\s+[^a-zA-Z0-9_.+-]/m,
        /From:.*[^a-zA-Z0-9_.+-](:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})[^a-zA-Z0-9_.+-].*$/m,
        /From:.*[^a-zA-Z0-9_.+-](:<from>[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.+)?[a-zA-Z0-9-]+\.+[a-zA-Z0-9-.]{2,4})\s+[^a-zA-Z0-9_.+-].*$/m

    ];
    this.bodyRegexes = [];
    this.destinationRegexes = [];

    EmailClientExtractorBase.call(this);
}

GenericClientExtractor.prototype.extractFromHTML = function (htmlstring)
{
    $ = cheerio.load(htmlstring);

    var sender, senderName, body, date, result;

    var text = $.root().text().replace(/\u00A0/g, ' ');

    sender = this.extractSenderFromText(text);

    if (sender == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the sender email address.");
    }

    senderName = this.extractSenderNameFromText(text);
    if (senderName == null)
    {
        // remove new lines from text to allow for easier parsing
        var newText = text.replace(/\n/g, ' ');
    }
    // senderName can be auto assigned to be the senderEmail by client, put senderName to null in that case
    if (senderName === sender)
    {
        senderName = null;
    }

    date = this.extractDateFromText(text);
    if (date == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the send date.");
    }

    body = this.extractBody($.root());
    if (body == null)
    {
        throw new errors.ExtractionError("Parsing failed. Couldn't find the body.");
    }

    result = {html: body, date: date, sender: sender, senderName: senderName};
    return result;
};


GenericClientExtractor.prototype.extractBody = function (rootNode)
{
    var finalBody = null;
    var self = this;

    function runExtractionMethods()
    {
        return new Promise(function (resolve, reject) {
            async.series({
                "extractBody_method_1": function (callback) {
                    var body = self.extractBody_method_1(rootNode);
                    if(body)
                    {
                        callback(null, body);
                    }
                    else {
                        callback(null, null);
                    }
                },
                "extractBody_outlook16": function (callback) {
                    var body = outlook_extraction_method();
                    if(body)
                    {
                        callback(null, body);
                    }
                    else {
                        callback(null, null);
                    }
                },
                "extractBody_after_header": function (callback) {
                    var body = self.extractBody_after_header(rootNode);
                    if(body)
                    {
                        callback(null, body);
                    }
                    else {
                        callback(null, null);
                    }
                },
                "extractBody_specialCase": function (callback) {
                    var body = self.extractBody_specialCase(rootNode);
                    if (body)
                    {
                        callback(null, body)
                    }
                    else
                    {
                        callback(null, null);
                    }
                },
                "extractBody_after_title": function (callback) {
                    var body = self.extractBody_specialCase(rootNode);
                    if (body)
                    {
                        callback(null, body);
                    }
                    else
                    {
                        callback(null, null)
                    }
                },
                "extractBody_findParent": function (callback) {
                    var body = self.extractBody_findParent(rootNode);
                    if (body)
                    {
                        callback(null, body)
                    }
                    else
                    {
                        callback(null, null)
                    }
                }
            }, function (err, extractions) {
                var extraction = null;
                var goodExtractions = [];
                for(var extractionKey in extractions)
                {
                    if (!extractions.hasOwnProperty(extractionKey)) continue;

                    extraction= extractions[extractionKey];
                    if(extraction)
                    {
                        goodExtractions.push({"extractionMethod": extractionKey, "extraction": extraction});
                    }
                }
                if(goodExtractions.length === 0)
                {
                    reject(extraction)
                }
                else{
                    var bestExtraction = null;
                    var bestExtractionLength = 0;

                    // Set the final extracted body to the extraction with most information, that does not contain information from the header
                    for(var i = 0; i < goodExtractions.length; i++)
                    {
                        var extractionString = JSON.stringify(goodExtractions[i].extraction);
                        if((extractionString.length > bestExtractionLength) && !extractionString.match(/To:/g) && !extractionString.match(/Subject:/g) && !extractionString.match(/Date:/g) && !extractionString.match(/From:/g))
                        {
                            bestExtraction = goodExtractions[i];
                            bestExtractionLength = extractionString.length;
                            finalBody = goodExtractions[i].extraction;
                        }
                    }
                    // If all extractions contain potential header information, use the extraction with the most information
                    if(!finalBody)
                    {
                        for(var i = 0; i < goodExtractions.length; i++)
                        {
                            var extractionString = JSON.stringify(goodExtractions[i].extraction);
                            if(extractionString.length > bestExtractionLength)
                            {
                                bestExtraction = goodExtractions[i];
                                bestExtractionLength = extractionString.length;
                                finalBody = goodExtractions[i].extraction;
                            }
                        }
                    }
                    resolve(goodExtractions);
                }
            });
        });
        function outlook_extraction_method()
        {
            var body = null;
            // We look for the div with class WordSection1 containing 2 elements:
            // a p and a blockquote.
            // The latter is the body
            var wordsections = $(rootNode).find('div.WordSection1');
            if (wordsections.length == 1)
            {
                if (wordsections[0] && wordsections[0].children && wordsections[0] && wordsections[0].children.length == 2)
                {
                    if (
                        wordsections[0].children[0].type == 'tag' &&
                        wordsections[0].children[0].name == 'p' &&
                        wordsections[0].children[1].type == 'tag' &&
                        wordsections[0].children[1].name == 'blockquote'
                    )
                    {
                        body = $(wordsections[0].children[1]).html();
                    }
                }
            }
            if (body)
            {
                return body;
            }
            else
            {
                return null;
            }
        }
    }
    runExtractionMethods().then(function (extractedBody) {
        finalBody = extractedBody;
    });
    return finalBody;
};

GenericClientExtractor.prototype.extractBody_after_header = function (rootNode)
{
    // find the first text node that has "From:"
    var fromNodeResult = this.findFromNode(rootNode[0].children);
    if (!fromNodeResult.isMatchFound)
    {
        // no match found
        return null;
    }
    var fromNode = fromNodeResult.node;
    var parentNode = fromNode.parent;
    if (parentNode && parentNode.type == 'tag' && parentNode.name == 'b')
    {
        parentNode = parentNode.parent;
    }
    var body_clone = $(parentNode).clone();
    body_clone.empty();

    // copy all nodes after the "Date:" node, the "Subject:" node and the "To:" node
    var j = 0;
    var isDateNodeFound = false;
    var isToNodeFound = false;
    var isLastNodeFoundTo = false;
    var isSubjectNodeFound = false;
    if (!parentNode)
    {
        parentNode = rootNode;
        body_clone = $(rootNode[0]).clone();
    }
    var containerDiv = this.findContainerDiv(rootNode);

    if (containerDiv && containerDiv[0] && containerDiv[0] == parentNode)
    {
        /*parentNode = rootNode;
         body_clone = $(rootNode).clone();*/
        var html = "";
        var children = rootNode[0].children;
        var containerFound = false;
        for (var i = 0; i < children.length; i++)
        {
            var child = children[i];
            if(containerFound)
            {
                if(child.type == 'tag' && $(child).html())
                {
                    html += $(child).html();
                }
                else if(child.type == 'text' && child.data)
                {
                    html += child.data;
                }
            }
            if(child == containerDiv[0])
            {
                containerFound = true;
            }
        }
        if(html)
        {
            if(html == "" || html.replace(/\s/, '') == "")
            {
                return null;
            }
            return html;
        }
        else
        {
            var body_clone = $(parentNode).clone();
            body_clone.empty();
        }
    }

    var children = $(parentNode)[0].children;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (isSubjectNodeFound && isDateNodeFound && isToNodeFound) {
            if($(child.parent).find('blockquote').length)
            {
                //body_clone[0].children[0] = $(child.parent).find('blockquote')[0];
                for (var i = 0; i < $(child.parent).find('blockquote')[0].children.length; i++)
                {
                    var new_child = $(child.parent).find('blockquote')[0].children[i];
                    if (body_clone.html() ||
                        (!body_clone.html() && new_child.type === "tag" && new_child.name !== "a" && new_child.name !== "br") ||
                        (!body_clone.html() && new_child.type === "text" &&
                        $(new_child).text().trim() !== "" &&
                        $(new_child).text().trim() !== ">" &&
                        $(new_child).text().trim() !== "<" &&
                        $(new_child).text().trim() !== "\" <" &&
                        $(new_child).text().trim() !== "Cc:  <")
                    )
                    {
                        body_clone[0].children[j++] = $(child.parent).find('blockquote')[0].children[i];
                    }
                }
                break;
            }
            if (!isLastNodeFoundTo)
            {
                if( body_clone.html() ||
                    (!body_clone.html() && child.type === "tag" && child.name !== "a" && child.name !== "br") ||
                    (!body_clone.html() && child.type === "text" &&
                    $(child).text().trim() !== "" &&
                    $(child).text().trim() !== ">" &&
                    $(child).text().trim() !== "<" &&
                    $(child).text().trim() !== "\" <" &&
                    $(child).text().trim() !== "Cc:  <")
                )
                {
                    body_clone[0].children[j++] = children[i];
                }
            }
        }
        if (!isDateNodeFound) {
            if (child.type === "text" && child.data.match(/Date:/g))
            {
                isDateNodeFound = true;
            }
            if ($(child).text() &&  $(child).text().match(/Date:/g))
            {
                isDateNodeFound = true;
            }
        }
        if (!isSubjectNodeFound) {
            if (child.type === "text" && child.data.match(/Subject:/g))
            {
                isSubjectNodeFound = true;
            }
            if ($(child).text() &&  $(child).text().match(/Subject:/g))
            {
                isSubjectNodeFound = true;
            }
        }
        if (!isToNodeFound) {
            if (child.type === "text" && child.data.match(/To:/g))
            {
                isToNodeFound = true;
                isLastNodeFoundTo = true;
            }
            if ($(child).text() &&  $(child).text().match(/To:/g))
            {
                isToNodeFound = true;
                isLastNodeFoundTo = true;
            }
        }
        else {
            isLastNodeFoundTo = false;
        }
    }

    if (body_clone.html() == "")
    {
        return null;
    }
    return body_clone.html();

};

GenericClientExtractor.prototype.extractBody_specialCase = function (rootNode)
{
    // find the first text node that has "From:"
    var fromNodeResult = this.findFromNode(rootNode[0].children);
    if (!fromNodeResult || (fromNodeResult && !fromNodeResult.isMatchFound))
    {
        // no match found
        return null;
    }

    var fromNode = fromNodeResult.node;

    // sometimes to:, date: and from: are not in the same parent tag

    // find the first text node that has "To:"
    var toNodeResult = this.findToNode(rootNode[0].children);
    if (!toNodeResult || (toNodeResult && !toNodeResult.isMatchFound))
    {
        // no match found
        return null;
    }

    var toNode = toNodeResult.node;

    // find the first text node that has "Reply-To:"
    var replyToNodeResult = this.findReplyToNode(rootNode[0].children);
    var replyToNode = null;
    var replyToParentDiv = null;
    if (replyToNodeResult && replyToNodeResult.isMatchFound)
    {
        replyToNode = replyToNodeResult.node;
        replyToParentDiv = this.findParentDiv(replyToNode);
    }

    // find the first parent node that is a <div>
    var fromParentDiv = this.findParentDiv(fromNode);
    if (!fromParentDiv)
    {
        // no match found
        return null;
    }

    var toParentDiv = this.findParentDiv(toNode);
    if (!toParentDiv)
    {
        // no match found
        return null;
    }

    var noContainerParent = false;
    var parentDiv = fromParentDiv;
    if(toParentDiv !== parentDiv/* || dateParentDiv !== parentDiv*/)
    {
        var lastChildBeforeParentFrom = null;
        var lastChildBeforeParentTo = null;
        var lastChildBeforeParentReplyTo = null;
        //var lastChildBeforeParentDate = null;

        // find common parent
        while(fromParentDiv !== toParentDiv) {
            lastChildBeforeParentFrom = fromParentDiv;
            lastChildBeforeParentTo = toParentDiv;
            toParentDiv = this.findGenericParentTag(toParentDiv);
            fromParentDiv = this.findGenericParentTag(fromParentDiv);
            if (replyToNode)
            {
                lastChildBeforeParentReplyTo = replyToParentDiv;
                replyToParentDiv = this.findGenericParentTag(replyToParentDiv);
            }
        }
        var max = -1;
        if (fromParentDiv && fromParentDiv.children)
        {
            for(var j = 0; j < fromParentDiv.children.length; j++)
            {
                if(j > max && fromParentDiv.children[j] === lastChildBeforeParentFrom)
                {
                    max = j;
                    parentDiv = lastChildBeforeParentFrom;
                }
                if(j > max && fromParentDiv.children[j] === lastChildBeforeParentTo)
                {
                    max = j;
                    parentDiv = lastChildBeforeParentTo;
                }
                if(lastChildBeforeParentReplyTo && j > max && fromParentDiv.children[j] === lastChildBeforeParentReplyTo)
                {
                    max = j;
                    parentDiv = lastChildBeforeParentReplyTo;
                }
            }
        }
        if(max > -1)
            noContainerParent = true;
    }

    var containerDiv = this.findGenericParentTag(parentDiv);
    //var containerDiv = this.findParentDiv(parentDiv);

    if (!containerDiv)
    {
        // no match found
        return null;
    }

    if(containerDiv.parent && !noContainerParent && containerDiv.parent.name !== 'html')
    {
        parentDiv = parentDiv.parent;
        containerDiv = containerDiv.parent;
    }

    // clone the containerDiv but only copy the body (leave out the header)
    var body_clone = $(containerDiv).clone();
    body_clone.empty();

    // find the first node after the mime headers
    var siblingBrTagIndex = 3;

    // copy all the remaining sibling elements after (and including) the siblingBrTag
    var j = 0;
    if(containerDiv[0]) {
        for (var i = siblingBrTagIndex; i < containerDiv[0].children.length; i++) {
            body_clone[0].children[j++] = containerDiv[0].children[i];
        }
    }
    else if(containerDiv.children)
    {
        var headerFound = false;
        for (var i = 0; i < containerDiv.children.length; i++) {
            if(headerFound)
            {
                body_clone[0].children[j++] = containerDiv.children[i];
            }
            if(containerDiv.children[i] == parentDiv)
            {
                headerFound = true;
            }
        }
    }
    else {
        return null;
    }


    if(body_clone.html().replace(/\s*/mgi, '') == '')
    {
        return null;
    }
    return body_clone.html();
};

GenericClientExtractor.prototype.extractBody_findParent = function (rootNode)
{
    // find the first text node that has "From:"
    var fromNodeResult = this.findFromNode(rootNode[0].children);
    if (!fromNodeResult.isMatchFound)
    {
        // no match found
        return null;
    }
    var fromNode = fromNodeResult.node;
    var divNode = null;
    var lastNode = false;

    while(fromNode.parent)
    {
        divNode = fromNode;
        fromNode = fromNode.parent;

        if(lastNode)
        {
            break;
        }

        if(
            (fromNode.type === 'tag' && fromNode.name === 'div' && fromNode.attribs.id === 'divRplyFwdMsg')
        )
        {
            lastNode = true;
        }
        else if(
            (fromNode.type === 'tag' && fromNode.name === 'div' && fromNode.attribs.name === 'quote') ||
            (fromNode.type === 'tag' && fromNode.name === 'div' && fromNode.attribs.name === 'messageReplySection') ||
            (fromNode.type === 'tag' && fromNode.name === 'div' && fromNode.attribs.name === 'quoted-content') ||
            (fromNode.type === 'tag' && fromNode.name === 'div' && fromNode.attribs.class === 'gmail_quote') ||
            (fromNode.type === 'tag' && fromNode.name === 'div' && fromNode.attribs.style && fromNode.attribs.style.length > 100) ||
            (fromNode.type === 'tag' && fromNode.name === 'span' && fromNode.attribs.id === 'OLK_SRC_BODY_SECTION')
        )
        {
            break;
        }
    }
    var collect_only_html = false;
    if(this.isNodeRootChild(rootNode, fromNode))
    {
        divNode = fromNode;
        fromNode = rootNode;
        collect_only_html = true;
    }

    var parentNode = fromNode;
    var body_clone;
    if(collect_only_html)
    {
        body_clone = "";
    }
    else
    {
        body_clone = $(parentNode).clone();
        body_clone.empty();
    }


    var j = 0;
    var children = null;
    if($(parentNode) && $(parentNode)[0] && $(parentNode)[0].hasOwnProperty('children'))
    {
        children = $(parentNode)[0].children;
    }


    var isMarkFound = false;
    var isForwardFound = false;
    if(!children)
    {
        return null;
    }

    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];

        if(isMarkFound)
        {
            if(collect_only_html)
            {
                if($(child).html())
                {
                    body_clone += $(child).html();
                }
            }
            else
            {
                if (!isForwardFound && $(child).html() && $(child).html().indexOf("----- Forwarded Message -----") >= 0)
                {
                    var newNode = this.findForwardStringNode(child.children);
                    if (newNode.node.parent)
                    {
                        body_clone = $(newNode.node.parent).clone();
                        body_clone.empty();

                        divNode = newNode.node;
                        isForwardFound = true;
                        isMarkFound = false;

                        children = $(newNode.node.parent)[0].children;
                        j = 0;
                        i = -1;
                    }
                }
                if (i > -1)
                {
                    if (body_clone.html() ||
                        (children[i].type === 'tag' && children[i].name === 'div' && children[i].attribs.name === 'quoted-content') ||
                        (!body_clone.html() && $(children[i]).text().replace(/\s*/mgi, '') !== '')
                    )
                    {
                        body_clone[0].children[j++] = children[i];
                    }
                }
            }
        }


        if(divNode == child)
        {
            isMarkFound = true;
        }
    }

    if(collect_only_html)
    {
        if (body_clone === '\n')
        {
            return null;
        }
    }
    else
    {
        if (body_clone.html() === '\n')
        {
            return null;
        }
        body_clone = body_clone.html();
    }

    return body_clone;
};

GenericClientExtractor.prototype.isNodeRootChild = function (rootNode, node)
{
    var j = 0;
    if(!rootNode[0])
    {
        return false;
    }
    var children = rootNode[0].children;
    var found = false;
    for (var i = 0; i < children.length; i++)
    {
        if (children[i] == node)
        {
            found = true;
        }
    }
    return found;
};

GenericClientExtractor.prototype.extractBody_after_title = function (rootNode)
{
    var containerDiv = this.findSuperContainerDiv(rootNode);

    if(containerDiv === null)
    {
        return null;
    }
    var body_clone = containerDiv.clone();

    body_clone.empty();

    var j = 0;
    var children = containerDiv[0].children;
    var startCopying = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        if (startCopying || (child.type === "tag" && child.name === "title"))
        {
            body_clone[0].children[j++] = child;
            startCopying = true;
        }
    }

    return body_clone.html();
};

GenericClientExtractor.prototype.extractBody_method_1 = function (rootNode)
{
    // the container div has the header and body
    var containerDiv = this.findContainerDiv(rootNode);
    if(containerDiv == null)
    {
        return null;
    }
    // check for special case
    if (containerDiv[0].attribs.class == "h5")
    {
        return this.extractBodyH5(rootNode);
    }

    // clone the containerDiv but only copy the body (leave out the header)
    var body_clone = containerDiv.clone();
    body_clone.empty();

    // find the first sibling that is a <br>
    var siblingBrTagIndex = this.findBodyStartTagIndex(containerDiv);

    if (siblingBrTagIndex == 0)
    {
        // we did not find a proper BR tag index
        // try another method
        return null;
    }

    // copy all the remaining sibling elements after (and including) the siblingBrTag
    var j = 0;
    for (var i = siblingBrTagIndex; i < containerDiv[0].children.length; i++)
    {
        body_clone[0].children[j++] = containerDiv[0].children[i];
    }

    return body_clone.html();
};

GenericClientExtractor.prototype.extractBodyH5 = function (rootNode)
{
    var containerDiv = null;

    if(rootNode[0].children)
    {
        for(var i = 0; i < rootNode[0].children.length; i++)
        {
            if(rootNode[0].children[i].type === 'tag' && rootNode[0].children[i].children)
            {
                containerDiv = $(rootNode[0].children[i]);
            }
        }
    }

    if(!containerDiv || !containerDiv[0] || !containerDiv[0].children)
    {
        return null;
    }


    // clone the containerDiv but only copy the body (leave out the header)
    var body_clone = containerDiv.clone();
    body_clone.empty();

    // copy all the remaining sibling elements
    var bodyStartIndex = 1;
    var j = 0;
    for (var i = bodyStartIndex; i < containerDiv[0].children.length; i++)
    {
        body_clone[0].children[j++] = containerDiv[0].children[i];
    }

    return body_clone.html();
};

GenericClientExtractor.prototype.findSuperContainerDiv = function (rootNode)
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
    var parentDiv = this.findSuperParentDiv(fromNode);
    var parentNode = $(parentDiv);

    if(parentDiv == null)
    {
        var parentDiv = this.findGenericSuperParentTag(fromNode);
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
            parentDiv = this.findSuperParentDiv(parentNode[0]);
            if (parentDiv == null)
            {
                return null;
            }
            parentNode = $(parentDiv);
        }
    }
}

GenericClientExtractor.prototype.findContainerDiv = function (rootNode)
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
            if(!parentNode[0])
            {
                isContainerDivFound = true;
                return null;
            }
            parentDiv = this.findParentDiv(parentNode[0]);
            parentNode = $(parentDiv);
        }
    }
}

GenericClientExtractor.prototype.findBodyStartTagIndex = function (containerDiv)
{
    // find the first node after the mime headers
    var isFirstMimeHeaderFound = false;
    var isLastMimeHeaderFound = false;
    var lastMimeHeaderText = this.getLastMimeHeaderText(containerDiv.text());
    for (var i = 0; i < containerDiv[0].children.length; i++)
    {
        var child = containerDiv[0].children[i];
        var isMimeHeaderDiv = this.isMimeHeaderDiv(child);
        if (isMimeHeaderDiv)
        {
            if (!isFirstMimeHeaderFound) {isFirstMimeHeaderFound = true;}
            if (!isLastMimeHeaderFound)
            {
                if (this.isLastMimeHeaderDiv(child, lastMimeHeaderText))
                {
                    isLastMimeHeaderFound = true;
                }
            }

        }
        if (isFirstMimeHeaderFound && isLastMimeHeaderFound && !isMimeHeaderDiv)
        {
            return i;
        }
    }
    return 0;
};

GenericClientExtractor.prototype.isMimeHeaderDiv = function (node)
{
    var mimeHeaderText = null;
    try
    {
        mimeHeaderText = node.children[0].children[0].children[0].data.trim();
        if (this.isMimeHeaderText(mimeHeaderText))
        {
            return true;
        }
    }
    catch (err)
    {
        // try another format
        try
        {
            mimeHeaderText = node.children[1].children[0].children[1].data.trim();
            if (this.isMimeHeaderText(mimeHeaderText))
            {
                return true;
            }
        }
        catch (err)
        {
            // one more try
            try
            {
                mimeHeaderText = node.children[1].children[0].children[0].data.trim();
                if (this.isMimeHeaderText(mimeHeaderText))
                {
                    return true;
                }
            }
            catch (err)
            {
                return false;
            }
        }
    }

    return false;
};

GenericClientExtractor.prototype.isLastMimeHeaderDiv = function (node, lastMimeHeaderText)
{
    var mimeHeaderText = null;
    try
    {
        mimeHeaderText = node.children[0].children[0].children[0].data.trim();
        if (mimeHeaderText === lastMimeHeaderText)
        {
            return true;
        }
    }
    catch (err)
    {
        // try another format
        try
        {
            mimeHeaderText = node.children[1].children[0].children[1].data.trim();
            if (mimeHeaderText === lastMimeHeaderText)
            {
                return true;
            }
        }
        catch (err)
        {
            // one more try
            try
            {
                mimeHeaderText = node.children[1].children[0].children[0].data.trim();
                if (mimeHeaderText === lastMimeHeaderText)
                {
                    return true;
                }
            }
            catch (err)
            {
                return false;
            }
        }
    }
    return false;
};

GenericClientExtractor.prototype.findParentDiv = function (fromNode)
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

GenericClientExtractor.prototype.findSuperParentDiv = function (fromNode)
{
    if (!fromNode)
    {
        return null;
    }
    var node = fromNode.parent;
    var lastParent = null;
    var parentFound = false;

    if(!node)
    {
        return null;
    }
    while (!parentFound)
    {
        if (node.type === "tag" && node.name === "div")
        {
            lastParent = node;
            if(node.parent)
            {
                node = node.parent;
            }
            else
            {
                parentFound = true;
                return node;
            }
        }
        else
        {
            node = node.parent;
            if(node == null)
            {
                parentFound = true;
                if(lastParent)
                {
                    return lastParent
                }
                else
                {
                    return null;
                }
            }
        }
    }
};

GenericClientExtractor.prototype.findGenericSuperParentTag = function (fromNode)
{
    var node = fromNode.parent;
    var parentFound = false;
    var lastParent = null;

    if(!node)
    {
        return null;
    }
    while (!parentFound)
    {
        if (node.type === "tag" && (node.name === "div" || node.name === "p" || node.name === "blockquote" || node.name === "body" || node.name === "html"))
        {
            lastParent = node;
            if(node.parent)
            {
                node = node.parent;
            }
            else
            {
                parentFound = true;
                return node;
            }
        }
        else
        {
            node = node.parent;
            if(node == null)
            {
                parentFound = true;
                if(lastParent)
                {
                    return lastParent;
                }
                else
                {
                    return null;
                }
            }
        }
    }
};

GenericClientExtractor.prototype.findGenericParentTag = function (fromNode)
{
    if(!fromNode)
    {
        return null;
    }
    var node = fromNode.parent;
    var parentFound = false;

    if(!node)
    {
        return null;
    }
    while (!parentFound)
    {
        if (node.type === "tag" && (node.name === "div" || node.name === "p" || node.name === "blockquote" || node.name === "body" || node.name === "html"))
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

GenericClientExtractor.prototype.findForwardStringNode = function (children)
{
    var isMatchFound = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        // check for end condition
        if (child.type === "text" && child.data.match(/-------- Forwarded Message --------/g))
        {
            //  node found
            return {isMatchFound: true, node: child};
        }
        else if (child.children !== undefined && child.children.length > 0)
        {
            // make recursive call
            var result = this.findForwardStringNode(child.children);
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

GenericClientExtractor.prototype.findFromNode = function (children)
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

GenericClientExtractor.prototype.findDateNode = function (children)
{
    var isMatchFound = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        // check for end condition
        if (child.type === "text" && child.data.match(/Date:/g))
        {
            // From node found
            return {isMatchFound: true, node: child};
        }
        else if (child.children !== undefined && child.children.length > 0)
        {
            // make recursive call
            var result = this.findDateNode(child.children);
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

GenericClientExtractor.prototype.findReplyToNode = function (children)
{
    var isMatchFound = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        // check for end condition
        if (child.type === "text" && child.data.match(/Reply-To:/g))
        {
            // From node found
            return {isMatchFound: true, node: child};
        }
        else if (child.children !== undefined && child.children.length > 0)
        {
            // make recursive call
            var result = this.findReplyToNode(child.children);
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

GenericClientExtractor.prototype.findToNode = function (children)
{
    var isMatchFound = false;
    for (var i = 0; i < children.length; i++)
    {
        var child = children[i];
        // check for end condition
        if (child.type === "text" && child.data.match(/To:/g))
        {
            // To node found
            return {isMatchFound: true, node: child};
        }
        else if (child.children !== undefined && child.children.length > 0)
        {
            // make recursive call
            var result = this.findToNode(child.children);
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

GenericClientExtractor.prototype.findForwardInHTML = function (htmlstring)
{
    // step 1: remove line breaks
    var htmlOneString = htmlstring.replace(/\n/g, '');
    // step 2: check if we have a possible match for a generic mail forward
    var indexFrom = htmlOneString.indexOf('From:');
    var indexSubject = htmlOneString.indexOf('Subject:');
    var indexDate = htmlOneString.indexOf('Date:');
    if(indexDate < 0 )
    {
        // Try with Sent:
        indexDate = htmlOneString.indexOf('Sent:');
    }
    var indexTo = htmlOneString.indexOf('To:');
    var hasMatch = (indexFrom != -1 && indexSubject != -1 && indexDate != -1 && indexTo != -1) ? true : false;
    if (hasMatch)
    {
        return indexFrom;
    }
    return -1;
};


GenericClientExtractor.prototype.findForwardInRawText = function (htmlstring)
{
    var indexFrom = htmlstring.indexOf('From:');
    var indexSubject = htmlstring.indexOf('Subject:');
    var indexDate = htmlstring.indexOf('Date:');
    if(indexDate < 0 )
    {
        // Try with Sent:
        indexDate = htmlstring.indexOf('Sent:');
    }
    var indexTo = htmlstring.indexOf('To:');
    var hasMatch = (indexFrom != -1 && indexSubject != -1 && indexDate != -1 && indexTo != -1) ? true : false;
    if (hasMatch)
    {
        return indexFrom;
    }
    return -1;
};

GenericClientExtractor.prototype.__proto__ = EmailClientExtractorBase.prototype;

module.exports = GenericClientExtractor;

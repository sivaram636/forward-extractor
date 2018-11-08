const Utils = {
    getUTCTime: function (date)
    {
        return date.getTime() - date.getTimezoneOffset() * 1000 * 60;
    },
    getLocalTime: function (date)
    {
        var offset = date.getTimezoneOffset();
        var newDate = new Date(date.getTime() + offset*60*1000);
        return newDate;
    },
    reduceHTMLWhitespace: function (html) {
        return html.replace(/\s+/g, " ");
    }
}

module.exports = Utils;





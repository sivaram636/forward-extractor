unforward
==============

Each email client has its own way of forwarding an Email. Some wrap the original message in a div with a unique class name. Others aren't so nice.

Unforward is a tool for retrieving the original email body and email address in a chain of forwarded emails.


Example:

```
    var unforward = require('unforward');
    
    var emailHtml = '......';
    
    unforward(emailHtml, "html", function (err, original, debugInfo)
    {
        console.log("Original Sender", original.sender);
        console.log("Original Date", original.date);
        console.log("Original Body", original.html);
    }
```

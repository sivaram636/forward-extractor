#!/usr/bin/env node
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
 * Created by bradley on 16/05/14.
 */


var readline = require('readline');
var Extractor = require('../lib/Extractor');
var errors = require("../lib/Errors");

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});


var buffer = "";
rl.on('line', function (line)
{
    buffer += line + "\n";
});


rl.on('close', function ()
{
    var extractor = new Extractor();
    extractor.extractFromMIME(buffer.toString(), function(err, result)
    {
        if (err)
        {
            console.log(JSON.stringify(err, null, 2));
        }
        else
        {
            console.log(JSON.stringify(result, null, 2));
        }
    });
});

//! Adapted for use in Sonus by Evan Cohen @_evnc
//! annyang
//! version : 2.5.0
//! author  : Tal Ater @TalAter
//! license : MIT
//! https://www.TalAter.com/annyang/
"use strict";

let annyang;
let commandsList = [];
const callbacks = { start: [], error: [], end: [], result: [], resultMatch: [], resultNoMatch: [], errorNetwork: [], errorPermissionBlocked: [], errorPermissionDenied: [] };
let recognition;
let debugState = false;

// The command matching code is a modified version of Backbone.Router by Jeremy Ashkenas, under the MIT license.
const optionalParam = /\s*\((.*?)\)\s*/g;
const optionalRegex = /(\(\?:[^)]+\))\?/g;
const namedParam = /(\(\?)?:\w+/g;
const splatParam = /\*\w+/g;
const escapeRegExp = /[\-{}\[\]+?.,\\\^$|#]/g;
const commandToRegExp = function (command) {
    command = command.replace(escapeRegExp, '\\$&')
        .replace(optionalParam, '(?:$1)?')
        .replace(namedParam, function (match, optional) {
            return optional ? match : '([^\\s]+)';
        })
        .replace(splatParam, '(.*?)')
        .replace(optionalRegex, '\\s*$1?\\s*');
    return new RegExp('^' + command + '$', 'i');
};

// This method receives an array of callbacks to iterate over, and invokes each of them
const invokeCallbacks = callbacks => {
    let args = Array.prototype.slice.call(arguments, 1);
    callbacks.forEach(callback =>
        callback.callback.apply(callback.context, args)
    );
};

const isInitialized = () => {
    return recognition !== undefined;
};

// method for logging in developer console when debug mode is on
const logMessage = (text, extraParameters) => {
    if (text.indexOf('%c') === -1 && !extraParameters) {
        console.log(text);
    } else {
        extraParameters = extraParameters || '';
        console.log(text, extraParameters);
    }
};

const initIfNeeded = () => {
    if (!isInitialized()) {
        annyang.init({}, false);
    }
};

const registerCommand = (command, cb, phrase) => {
    commandsList.push({ command: command, callback: cb, originalPhrase: phrase });
    if (debugState) {
        logMessage('Command successfully loaded: %c' + phrase);
    }
};

const parseResults = function (results) {
    invokeCallbacks(callbacks.result, results);
    let commandText;
    // go over each of the 5 results and alternative results received (we've set maxAlternatives to 5 above)
    for (let i = 0; i < results.length; i++) {
        // the text recognized
        commandText = results[i].trim();
        if (debugState) {
            logMessage('Speech recognized: %c' + commandText);
        }

        // try and match recognized text to one of the commands on the list
        for (let j = 0, l = commandsList.length; j < l; j++) {
            const currentCommand = commandsList[j];
            const result = currentCommand.command.exec(commandText);
            if (result) {
                const parameters = result.slice(1);
                if (debugState) {
                    logMessage('command matched: %c' + currentCommand.originalPhrase);
                    if (parameters.length) {
                        logMessage('with parameters', parameters);
                    }
                }
                // execute the matched command
                currentCommand.callback.apply(this, parameters);
                invokeCallbacks(callbacks.resultMatch, commandText, currentCommand.originalPhrase, results);
                return;
            }
        }
    }
    invokeCallbacks(callbacks.resultNoMatch, results);
};

annyang = {

    init: (commands, resetCommands) => {
        if (resetCommands === undefined) {
            resetCommands = true;
        } else {
            resetCommands = !!resetCommands;
        }

        if (resetCommands) {
            commandsList = [];
        }
        if (commands.length) {
            this.addCommands(commands);
        }
    },

    debug: newState => {
        if (arguments.length > 0) {
            debugState = !!newState;
        } else {
            debugState = true;
        }
    },

    addCommands: commands => {
        let cb;

        initIfNeeded();

        for (const phrase in commands) {
            if (commands.hasOwnProperty(phrase)) {
                cb = global[commands[phrase]] || commands[phrase];
                if (typeof cb === 'function') {
                    // convert command to regex then register the command
                    registerCommand(commandToRegExp(phrase), cb, phrase);
                } else if (typeof cb === 'object' && cb.regexp instanceof RegExp) {
                    // register the command
                    registerCommand(new RegExp(cb.regexp.source, 'i'), cb.callback, phrase);
                } else {
                    if (debugState) {
                        logMessage('Can not register command: %c' + phrase);
                    }
                    continue;
                }
            }
        }
    },

    removeCommands: commandsToRemove => {
        if (commandsToRemove === undefined) {
            commandsList = [];
            return;
        }
        commandsToRemove = Array.isArray(commandsToRemove) ? commandsToRemove : [commandsToRemove];
        commandsList = commandsList.filter(command => {
            for (let i = 0; i < commandsToRemove.length; i++) {
                if (commandsToRemove[i] === command.originalPhrase) {
                    return false;
                }
            }
            return true;
        });
    },

    addCallback: (type, callback, context) => {
        if (callbacks[type] === undefined) {
            return;
        }
        var cb = global[callback] || callback;
        if (typeof cb !== 'function') {
            return;
        }
        callbacks[type].push({ callback: cb, context: context || this });
    },

    removeCallback: (type, callback) => {
        const compareWithCallbackParameter = function (cb) {
            return cb.callback !== callback;
        };
        // Go over each callback type in callbacks store object
        for (const callbackType in callbacks) {
            if (callbacks.hasOwnProperty(callbackType)) {
                // if this is the type user asked to delete, or he asked to delete all, go ahead.
                if (type === undefined || type === callbackType) {
                    // If user asked to delete all callbacks in this type or all types
                    if (callback === undefined) {
                        callbacks[callbackType] = [];
                    } else {
                        // Remove all matching callbacks
                        callbacks[callbackType] = callbacks[callbackType].filter(compareWithCallbackParameter);
                    }
                }
            }
        }
    },

    trigger: sentences => {
        if (!Array.isArray(sentences)) {
            sentences = [sentences];
        }

        parseResults(sentences);
    }
};

module.exports = annyang
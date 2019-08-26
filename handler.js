'use strict';

const {create, env} = require ('sanctuary');

const {env: flutureEnv} = require ('fluture-sanctuary-types');

const S = create ({
    checkTypes: process.env.NODE_ENV !== 'production',
    env: env.concat (flutureEnv)
});
const Future = require ('fluture');

const AWS = require ('aws-sdk');
const s3 = new AWS.S3 ();

const Alexa = require ('alexa-sdk');
const APP_ID = 'amzn1.ask.skill.03f0f63f-d84e-49a9-8fbd-cb069b642fa6';

const s3Service = require ('./lib/s3-service');
const getSignedUrlForKey = s3Service.signedUrl (s3) ('getObject') (90) ('bills-audio-clips');

// Takes a Future of array, each element being a response from a listObjectsV2 request and concatenates
// the elements in each 'Contents' array
const getBucketContents = S.map (S.reduce (acc => elem => S.concat (acc) (elem.Contents)) ([]));

// HTML escape
const escape_HTML = html_str => {
    const chars_to_replace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#039;'
    };

    return html_str.replace (/[&<>"']/g, tag => chars_to_replace[tag] || tag);
};

const getRandomInt = max => Math.floor (Math.random () * Math.floor (max));

// Get all the basenames from the S3 bucket. The audio clips are stored using the key: 'clips/<basename>.mp3'
// The manifests are stored using the key: 'manifests/<basename>.json'
// This MUST be declared the old-fashioned way as it is a 'bound' function
// todo Rewrite this as a function that doesn't know anything about Futures. It would be called as a parameter to Future.map
function getBasenames(s3) {

    if (this.attributes.basenames) return Future.resolve (this.attributes.basenames);

    const bucketList = s3Service.listBucket (s3) ('bills-audio-clips', 'manifests');
    const bucketContents = getBucketContents (bucketList);

    return Future.map (S.reduce (acc => obj => {
        const key = obj.Key;
        const start = key.lastIndexOf ('/');
        if (start === -1) return acc;
        const end = key.lastIndexOf ('.json');
        if (end === -1) return acc;
        const basename = key.substring (start + 1, end);

        return S.append (basename) (acc);
    }) ([])) (bucketContents);
}

// Return a bound function as we prefer the curried notation.
function selectEntry(s3) {
    return function (basenames) {
        console.log (`names: ${JSON.stringify (basenames)}`);
        this.attributes.basenames = basenames;

        // Choose a manifest entry at random
        const randomIndex = getRandomInt (basenames.length);
        const basename = basenames[randomIndex];

        console.log (`selected basename: ${basename}`);

        const objectBody = s3Service.getObject (s3) ('bills-audio-clips') (`manifests/${basename}.json`);
        return Future.map (body => ({basename: basename, ...JSON.parse (body)})) (objectBody);
    }.bind(this);
}
// -----------------------------------------------------

const states = {
    STARTMODE: '_STARTMODE'
};

/* INTENT HANDLERS */

const newSessionHandler = {
    'NewSession': function () {
        this.handler.state = states.STARTMODE;
        this.emit (':ask', 'Welcome to Identify That Audio Clip. Would you like to play?');
    }
};

const startModeHandlers =
    Alexa.CreateStateHandler (states.STARTMODE, {
        'AMAZON.YesIntent': function () {
            console.log (`YesIntent: ${JSON.stringify (this.event)}`);

            // todo Rewrite this to call 'Future.map'...
            const basenames = getBasenames.bind (this) (s3);

            const selected = Future.chain (selectEntry.bind (this) (s3)) (basenames);

            const signedUrl = Future.chain (selection => {
                console.log (`selected: ${JSON.stringify (selection)}`);
                return getSignedUrlForKey (`clips/${selection.basename}.mp3`);
            }) (selected);

            Future.fork (console.error, url => {
                const audioFile = `<audio src="${escape_HTML (url)}" />`;
                console.log (`audio tag: ${audioFile}`);
                this.emit (':tell', `${audioFile}`);
            }) (signedUrl);
        },

        'AMAZON.NoIntent': function () {
            console.log (`NoIntent: ${JSON.stringify (this.event)}`);
            this.emit (':tell', 'Ok, see you next time!');
        },

        'SessionEndedRequest': function () {
            console.log ('Session ended');
            this.emit (':tell', 'Your session has ended');
        },

        'Unhandled': function () {
            console.error (`Unhandled: ${this.handler.state}`);
            const message = 'Sorry, I don\'t know what to do now';
            this.emit (':ask', message, 'Please try again');
        }
    });

exports.handler = function (event, context) {
    console.log (`REQUEST++++${JSON.stringify (event)}`);

    const alexa = Alexa.handler (event, context);

    alexa.appId = APP_ID;

    alexa.registerHandlers (newSessionHandler, startModeHandlers);

    alexa.execute ();

};

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

            // Choose a manifest entry at random
            const bucketList = s3Service.listBucket (s3) ('bills-audio-clips', 'manifests');
            const bucketContents = getBucketContents (bucketList);

            bucketContents.pipe (Future.chain (manifests => {
                // todo For now, simply log the contents
                console.log (`manifests: ${JSON.stringify(manifests)}`);

                return getSignedUrlForKey ('clips/blunders.mp3');
            })).pipe (Future.fork (console.error, url => {
                const audioFile = `<audio src="${escape_HTML (url)}" />`;
                console.log (`audio tag: ${audioFile}`);
                this.emit (':tell', `${audioFile}`);
            }));
            //
            // // todo For now, just play the audio file and quit.
            // // Use a signed URL as all other attempts to access private bucket have failed
            // // todo Consider adding an Expires parameter
            // const signedUrl = getSignedUrlForKey ('clips/blunders.mp3');
            //
            // signedUrl.fork (console.error, url => {
            //     const audioFile = `<audio src="${escape_HTML (url)}" />`;
            //     console.log (`audio tag: ${audioFile}`);
            //     this.emit (':tell', `${audioFile}`);
            // });
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

//
// const f = Future.resolve(42).pipe(Future.map(v => v/2));
// console.log(f);
// f.fork(console.error, console.log);

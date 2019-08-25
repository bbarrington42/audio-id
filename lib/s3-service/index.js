'use strict';

// Use Sanctuary as S and Fluture as Future - include types
const {create, env} = require ('sanctuary');

const {env: flutureEnv} = require ('fluture-sanctuary-types');

const S = create ({
    checkTypes: process.env.NODE_ENV !== 'production',
    env: env.concat (flutureEnv)
});

const Future = require ('fluture');


const AWS = require ('aws-sdk');
const s3 = new AWS.S3 ();

// Returns a Future of an array of JSON objects
const listBucket = s3 => (bucket, folder = '', token = null) => {
    const makeParams = token => {
        return {
            Bucket: bucket,
            Prefix: folder,
            ContinuationToken: token
        };
    };
    let truncated = true;
    let acc = [];
    const gen = function* () {
        while (truncated) {
            const params = makeParams (token);
            const json = yield Future ((reject, resolve) => {
                s3.listObjectsV2 (params, (err, data) =>
                    err ? reject (err) : resolve (data));
            });
            // Push the result
            acc.push (json);
            truncated = json.IsTruncated;
            token = json.NextContinuationToken;
        }
        return acc;
    };

    return Future.go (gen);
};


const signedUrl = s3 => operation => expiration => bucket => key => Future ((reject, resolve) => {
    const params = {
        Bucket: bucket,
        Key: key,
        Expires: expiration  // In seconds
    };
    s3.getSignedUrl (operation, params, (err, data) => err ? reject (err) : resolve (data));
});

// Returns the Body of an object in S3
const getObject = s3 => bucket => key => Future ((reject, resolve) => {
    const params = {
        Bucket: bucket,
        Key: key
    };
    s3.getObject (params, (err, data) => err ? reject (err) : resolve (data.Body));
});

module.exports = {
    listBucket,
    signedUrl,
    getObject
};

//
// const f = getObject (s3) ('bills-audio-clips') ('manifests/napalm.json');
// Future.fork (console.error, data => console.log(data)) (f);

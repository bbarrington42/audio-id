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
            ContinuationToken: token,
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

const f = listBucket (s3) ('bills-audio-clips', 'manifests');

// Concatenate the elements in each 'Contents' array
const f1 = S.map (S.reduce (acc => elem => S.concat (acc) (elem.Contents)) ([])) (f);


Future.fork (console.error, console.log) (f1);

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


const listBucket = s3 => (bucket, folder = '', max_count = 1, token = null) => Future ((reject, resolve) => {
    const params = {
        Bucket: bucket,
        Prefix: folder,
        ContinuationToken: token,
        MaxKeys: max_count
    };

    s3.listObjectsV2 (params, (err, data) =>
        err ? reject (err) : resolve (data));
});


const f = listBucket (s3) ('bills-audio-clips', 'manifests');

Future.fork (console.error, console.log) (f);

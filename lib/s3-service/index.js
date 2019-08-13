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

const listBucket = s3 => (bucket, folder = S.Nothing) => Future ((reject, resolve) => {
    const mapped = S.map (folder => {
        return {Prefix: folder};
    }) (folder);
    const params = S.maybe ({Bucket: bucket}) (p => {
        p.Bucket = bucket;
        return p;
    }) (mapped);

    s3.listObjectsV2 (params, (err, data) =>
        err ? reject (err) : resolve (data));
});


const f = listBucket (s3) ('bills-audio-clips', S.Just ('manifests/'));

Future.fork (console.error, console.log) (f);

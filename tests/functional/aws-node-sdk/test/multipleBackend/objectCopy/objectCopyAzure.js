const assert = require('assert');
const async = require('async');

const withV4 = require('../../support/withV4');
const BucketUtility = require('../../../lib/utility/bucket-util');
const constants = require('../../../../../../constants');
const { config } = require('../../../../../../lib/Config');
const { getAzureClient, getAzureContainerName } = require('../utils');
const { createEncryptedBucketPromise } =
    require('../../../lib/utility/createEncryptedBucket');

const azureLocation = 'azuretest';
const azureClient = getAzureClient();
const azureContainerName = getAzureContainerName();

const bucket = 'buckettestmultiplebackendobjectcopy';
const key = `azureputkey-${Date.now()}`;
const copyKey = `azurecopyKey-${Date.now()}`;
const body = Buffer.from('I am a body', 'utf8');
const normalMD5 = 'be747eb4b75517bf6b3cf7c5fbb62f3a';
const emptyMD5 = 'd41d8cd98f00b204e9800998ecf8427e';
const locMetaHeader = constants.objectLocationConstraintHeader.substring(11);

let bucketUtil;
let s3;
const describeSkipIfNotMultiple = (config.backends.data !== 'multiple'
    || process.env.S3_END_TO_END) ? describe.skip : describe;

const copyParamBase = {
    Bucket: bucket,
    Key: copyKey,
    CopySource: `/${bucket}/${key}`,
};

function putSourceObj(location, isEmptyObj, cb) {
    const sourceParams = { Bucket: bucket, Key: key,
        Metadata: {
            'scal-location-constraint': location,
            'test-header': 'copyme',
        },
    };
    if (!isEmptyObj) {
        sourceParams.Body = body;
    }
    s3.putObject(sourceParams, (err, result) => {
        assert.equal(err, null, `Error putting source object: ${err}`);
        if (isEmptyObj) {
            assert.strictEqual(result.ETag, `"${emptyMD5}"`);
        } else {
            assert.strictEqual(result.ETag, `"${normalMD5}"`);
        }
        cb();
    });
}

function assertGetObjects(sourceKey, sourceBucket, sourceLoc, destKey,
destBucket, destLoc, azureKey, mdDirective, isEmptyObj, callback) {
    const sourceGetParams = { Bucket: sourceBucket, Key: sourceKey };
    const destGetParams = { Bucket: destBucket, Key: destKey };

    async.series([
        cb => s3.getObject(sourceGetParams, cb),
        cb => s3.getObject(destGetParams, cb),
        cb => azureClient.getBlobProperties(azureContainerName, azureKey, cb),
    ], (err, results) => {
        assert.equal(err, null, `Error in assertGetObjects: ${err}`);

        const [sourceRes, destRes, azureRes] = results;
        if (isEmptyObj) {
            assert.strictEqual(sourceRes.ETag, `"${emptyMD5}"`);
            assert.strictEqual(destRes.ETag, `"${emptyMD5}"`);
            // assert.strictEqual(awsRes.ETag, `"${emptyMD5}"`);
        } else {
            if (process.env.ENABLE_KMS_ENCRYPTION === 'true') {
                assert.strictEqual(sourceRes.ServerSideEncryption, 'AES256');
                assert.strictEqual(destRes.ServerSideEncryption, 'AES256');
                // assert.strictEqual(awsRes.ServerSideEncryption, 'AES256');
            } else {
                assert.strictEqual(sourceRes.ETag, `"${normalMD5}"`);
                assert.strictEqual(destRes.ETag, `"${normalMD5}"`);
                assert.deepStrictEqual(sourceRes.Body, destRes.Body);
                // assert.strictEqual(awsRes.ETag, `"${normalMD5}"`);
                // assert.deepStrictEqual(sourceRes.Body, awsRes.Body);
            }
        }
        if (mdDirective === 'COPY') {
            assert.deepStrictEqual(sourceRes.Metadata['test-header'],
                destRes.Metadata['test-header']);
        }
        assert.strictEqual(sourceRes.ContentLength, destRes.ContentLength);
        assert.strictEqual(sourceRes.Metadata[locMetaHeader], sourceLoc);
        assert.strictEqual(destRes.Metadata[locMetaHeader], destLoc);
        callback();
    });
}

describeSkipIfNotMultiple('MultipleBackend object copy', function testSuite() {
    this.timeout(250000);
    withV4(sigCfg => {
        beforeEach(() => {
            bucketUtil = new BucketUtility('default', sigCfg);
            s3 = bucketUtil.s3;
            process.stdout.write('Creating bucket\n');
            if (process.env.ENABLE_KMS_ENCRYPTION === 'true') {
                s3.createBucketAsync = createEncryptedBucketPromise;
            }
            return s3.createBucketAsync({ Bucket: bucket })
            .catch(err => {
                process.stdout.write(`Error creating bucket: ${err}\n`);
                throw err;
            });
        });

        afterEach(() => {
            process.stdout.write('Emptying bucket\n');
            return bucketUtil.empty(bucket)
            .then(() => {
                process.stdout.write('Deleting bucket\n');
                return bucketUtil.deleteOne(bucket);
            })
            .catch(err => {
                process.stdout.write(`Error in afterEach: ${err}\n`);
                throw err;
            });
        });

        it.only('should copy an object from Azure to mem', done => {
            putSourceObj(azureLocation, false, () => {
                const copyParams = Object.assign({
                    MetadataDirective: 'REPLACE',
                    Metadata: {
                        'scal-location-constraint': 'mem',
                    } }, copyParamBase);
                s3.copyObject(copyParams, (err, result) => {
                    assert.equal(err, null, 'Expected success but got ' +
                    `error: ${err}`);
                    assert.strictEqual(result.CopyObjectResult.ETag,
                        `"${normalMD5}"`);
                    assertGetObjects(key, bucket, azureLocation, copyKey,
                        bucket, 'mem', key, 'REPLACE', false, done);
                });
            });
        });
    });
});
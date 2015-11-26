import routeGET from './routes/routeGET';
import routePUT from './routes/routePUT';
import routeDELETE from './routes/routeDELETE';
import routeHEAD from './routes/routeHEAD';
import routePOST from './routes/routePOST';
import metastore from './testdata/metadata.json';

export default (router) => {
    const datastore = {};

    /**
     * GET resource - supports both bucket and object
     * @param {string} path style - It can be /<bucket name> or /<object name>
     * @param {function} callback - Callback to be called upon completion
     */
    router.get("/(.*)", function handleRequest(request, response) {
        routeGET(request, response, datastore, metastore);
    });

    /**
     * PUT resource - supports both bucket and object
     * @param {string} path style - It can be /<bucket name> or /<object name>
     * @param {function} callback - Callback to be called upon completion
     */
    router.put('/(.*)', function handleRequest(request, response) {
        routePUT(request, response, datastore, metastore);
    });

    /**
     * PUTRAW object - called when data is not received in the body but
     * as part of request stream in chunks
     * @param {string} path style - It can be /<bucket name> or /<object name>
     * @param {function} callback - Callback to be called upon completion
     */
    router.putraw('/:resource/(.*)', function handleRequest(request, response) {
        routePUT(request, response, datastore, metastore);
    });


    /**
     * POST to initiate and complete multipart upload
     * @param {string} path style - It can be /<bucket name> or /<object name>
     * @param {function} callback - Callback to be called upon completion
     */
    router.post('/(.*)', function handleRequest(request, response) {
        routePOST(request, response, datastore, metastore);
    });

    /**
     * DELETE resource - deletes bucket or object
     * @param {string} path style - It can be /<bucket name> or /<object name>
     * @param {function} callback with request and response objects
     */

    router.delete('/(.*)', function handleRequest(request, response) {
        routeDELETE(request, response, datastore, metastore);
    });

    /**
     * HEAD resource - retrieves metadata for bucket or object without content
     * @param {string} path style - It can be /<bucket name> or /<object name>
     * @param {function} callback with request and response objects
     */
    router.head("/(.*)", function handleRequest(request, response) {
        routeHEAD(request, response, datastore, metastore);
    });
};
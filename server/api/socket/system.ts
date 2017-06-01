import App from '../../app';

module.exports = (app: App, socket: any) => {

	socket.on('system:clear-cache', (data, cb) => {
		app.controllers.system.clearCache()
			.then(() => cb(null))
			.catch(cb);
	});

	socket.on('system:get-config', async (data, cb) => {
		try {
			cb(null, await app.controllers.config)
		} catch (error) {
			cb(error);
		}
	});

	socket.on('system:set-config', (data, cb) => {
		app.controllers.system.clearCache()
			.then(() => cb(null))
			.catch(cb);
	});
};
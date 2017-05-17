import BackTest     from '../../classes/backtest/Backtest';

module.exports = (app, socket) => {

	let backTest = null;

	socket.on('backtest:run', (data, cb) => {
		// Ensure instruments is array
		if (typeof data.instruments === 'string') {
			data.instruments = data.instruments.split(',');
		}

		// Ensure instruments are uppercase
		data.instruments = data.instruments.map(instr => instr.toUpperCase());

		data = {
			ea: data.ea,
			equality: data.equality,
			instruments: data.instruments,
			timeFrame: data.timeFrame,
			from: parseInt(data.from, 10),
			until: parseInt(data.until, 10),
			pip: parseFloat(data.pips)
		};

		backTest = new BackTest(app, data);

		backTest
			.run()
			.then(report => {
				cb(null, report);
			})
			.catch(err => {
				console.error('error', err);
				cb(err);
			});
	});
};
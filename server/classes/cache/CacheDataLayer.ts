import * as fs          from 'fs';
import * as sqLite      from 'sqlite3';
import * as winston     from 'winston-color';

const TransactionDatabase = require('sqlite3-transactions').TransactionDatabase;

export default class CacheDataLayer {

	private _db: any;
	private _tableList = [];

	constructor(protected options) {
	}

	public async init() {
		await this._openDb();
		return this._setTableList();
	}

	public read(instrument: string, timeFrame: string, from: number, until: number, count = 500, bufferOnly?: boolean): Promise<Float64Array> {

		return this
			._createInstrumentTable(instrument, timeFrame)
			.then(() => {

				return new Promise((resolve, reject) => {

					let tableName = this._getTableName(instrument, timeFrame),
						queryString;

					winston.info(`DataLayer: Read ${tableName} from ${new Date(from)} until ${new Date(until)} count ${count}`);

					queryString = `SELECT data FROM ${tableName} `;

					if (count) {
						if (until) {
							queryString += `WHERE time <= ${until} ORDER BY time LIMIT ${count} `;
						} else {
							queryString += `WHERE time >= ${from} ORDER BY time LIMIT ${count} `;
						}
					} else {
						count = 300;

						if (from && until) {
							queryString += `WHERE time >= ${from} AND time <= ${until} ORDER BY time DESC LIMIT ${count}`;
						}
						else if (from) {
							queryString += `WHERE time >= ${from} ORDER BY time DESC LIMIT ${count}`;
						}
						else {

						}
					}

					this._db.all(queryString, (err, rows) => {

						if (err)
							return reject(err);

						let mergedBuffer = Buffer.concat(rows.map(row => row.data));

						resolve(mergedBuffer);
					});

				});
			});
	}

	public async write(instrument, timeFrame, buffer: NodeBuffer) {

		function toBuffer(ab) {
			var buf = new Buffer(ab.byteLength);
			var view = new Uint8Array(ab);
			for (let i = 0; i < buf.length; ++i) {
				buf[i] = view[i];
			}
			return buf;
		}

		function toArrayBuffer(buf) {
			var ab = new ArrayBuffer(buf.length);
			var view = new Uint8Array(ab);
			for (var i = 0; i < buf.length; ++i) {
				view[i] = buf[i];
			}
			return ab;
		}

		return new Promise((resolve, reject) => {

			this._createInstrumentTable(instrument, timeFrame)
				.then(tableName => {

					if (!buffer.length)
						return resolve();

					// if (Buffer.isBuffer(buffer))
					let candles = new Float64Array(toArrayBuffer(buffer)),
						rowLength = 10;

					winston.info('DataLayer: Write ' + candles.length / rowLength + ' candles to ' + tableName);

					this._db.beginTransaction((err, transaction) => {

						let stmt = transaction.prepare(`INSERT OR REPLACE INTO ${tableName} VALUES (?,?)`),
							i = 0, len = candles.length;

						for (; i < len; i += rowLength) {
							stmt.run([candles[i], toBuffer(candles.slice(i, i + rowLength).buffer)]);
						}

						stmt.finalize();

						transaction.commit(function (tErr: any) {
							if (tErr) return reject(tErr);

							resolve();
						});
					});
				})
				.catch(reject);
		});
	}

	/**
	 *
	 * @param instrument {string}
	 * @param timeFrame {string}
	 * @returns {Promise}
	 * @private
	 */
	private _createInstrumentTableIfNotExists(instrument, timeFrame) {
		return new Promise((resolve, reject) => {

			this._db.serialize(() => {
				let tableName = this._getTableName(instrument, timeFrame),
					fields = [
						'time int PRIMARY KEY',
						'openBid double',
						'openAsk double',
						'highBid double',
						'highAsk double',
						'lowBid double',
						'lowAsk double',
						'closeBid double',
						'closeAsk double',
						'volume int',
						'complete bool'
					];

				this._db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${fields.join(',')})`, function () {
					resolve(tableName);
				});
			});
		})
	}

	private _createInstrumentTable(instrument, timeFrame) {
		return new Promise((resolve, reject) => {

			this._db.serialize(() => {
				let tableName = this._getTableName(instrument, timeFrame),
					fields = [
						'time int PRIMARY KEY',
						'data blob'
					];

				this._db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${fields.join(',')})`, function () {
					resolve(tableName);
				});
			});
		})
	}

	public async reset(instrument?: string, timeFrame?: string, from?: number, until?: number): Promise<void> {
		await this._closeDb();

		if (fs.existsSync(this.options.path))
			fs.unlinkSync(this.options.path);

		await this._openDb();
	}

	// public readLast2() {
	//     setTimeout(() => {
	//         this._db.run(`SELECT * FROM ${tableName} LIMIT 10 OFFSET (SELECT COUNT(*) FROM ${tableName})-10; (${fields.join(',')})`, function () {
	//            console.log()
	//         });
	//     }, 500);
	// }

	private _setTableList() {
		return new Promise((resolve, reject) => {
			this._db.run(`.tables`, (err: any, tableList: Array<any>) => {
				this._tableList = tableList;
				resolve();
			});
		});
	}

	private _getTableName(instrument, timeFrame): string {
		return instrument.toLowerCase() + '_' + timeFrame.toLowerCase();
	}

	private async _openDb() {
		return this._db = new TransactionDatabase(
			new sqLite.Database(this.options.path)
		);
		// this._db = new sqlLite.Database('database.db');
		// this._db = new sqLite.Database(this._pathDb);
		// this._db = new sqlLite.Database(':memory:');
	}

	private _closeDb() {
		this._db.close();
	}
}
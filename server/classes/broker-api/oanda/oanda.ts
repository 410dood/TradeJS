import Base from '../../Base';
import * as constants from '../../../../shared/constants/broker';

const OANDAAdapter = require('./oanda-adapter/index');

export default class BrokerApi extends Base {

	private _client = null;

	constructor(private _accountSettings: AccountSettings) {
		super()
	}

	public async init() {
		this._client = new OANDAAdapter({
			// 'live', 'practice' or 'sandbox'
			environment: this._accountSettings.environment,
			// Generate your API access in the 'Manage API Access' section of 'My Account' on OANDA's website
			accessToken: this._accountSettings.token,
			// Optional. Required only if environment is 'sandbox'
			username: this._accountSettings.username
		});
	}

	public async testConnection(): Promise<boolean> {
		// TODO: Stupid way to check, and should also check heartbeat
		try {
			await this.getAccounts();

			return true;
		} catch (error) {
			return false;
		}
	}

	public getAccounts(): Promise<any> {
		return new Promise((resolve, reject) => {
			this._client.getAccounts(function (err, accounts) {
				if (err)
					return reject(err);

				resolve(accounts);
			});
		})
	}

	public subscribeEventStream() {
		this._client.subscribeEvents(function (event) {
			console.log(event);
		}, this);
	}

	public subscribePriceStream(instrument) {
		this._client.subscribePrice(this._accountSettings.accountId, instrument.toUpperCase(), tick => {
			this.emit('tick', tick);
		}, this);
	}

	public unsubscribePriceStream(instrument) {

	}

	public getInstruments(): any {
		return new Promise((resolve, reject) => {
			this._client.getInstruments(this._accountSettings.accountId, (err, instruments) => {
				if (err)
					return reject(err);

				resolve(instruments);
			});
		});
	}

	public getCandles(instrument, timeFrame, from, until, count): Promise<Array<any>> {

		return new Promise((resolve, reject) => {

			this._client.getCandles(instrument, from, until, timeFrame, count, (err, candles) => {
				if (err) {
					console.log(err);
					return reject(err);
				}

				this._normalize(candles);

				resolve(candles);
			});
		});
	}

	public getCurrentPrices(instruments: Array<any>): Promise<Array<any>> {
		return new Promise((resolve, reject) => {
			this._client.getPrice(instruments, (err, prices) => {
				if (err)
					return reject(err);

				resolve(prices);
			});
		});
	}

	public async destroy(): Promise<void> {
		this.removeAllListeners();

		if (this._client)
			await this._client.kill();

		this._client = null;
	}

	private _normalize(candles) {
		let i = 0, len = candles.length;

		for (; i < len; i++)
			candles[i].time /= 1000;

		return candles;
	}
}
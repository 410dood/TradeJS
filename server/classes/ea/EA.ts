import Instrument from '../instrument/Instrument';
import OrderManager from '../../modules/order/OrderManager';
import AccountManager from '../../modules/account/AccountManager';

export interface IEA {
	orderManager: OrderManager;
	onTick(timestamp, bid, ask): Promise<any>|void;
}

export default class EA extends Instrument implements IEA {

	public tickCount = 0;
	public live = false;

	public accountManager: AccountManager;
	public orderManager: OrderManager;

	private _backtestData = {
		totalFetchTime: 0,
		startTime: null,
		endTime: null
	};

	constructor(...args) {
		super(args[0], args[1]);

		this.accountManager = new AccountManager({
			equality: this.options.equality
		});

		this.orderManager = new OrderManager(this.accountManager, {
			live: this.live
		});
	}

	public async init() {
		await super.init();

		await this.accountManager.init();
		await this.orderManager.init();

		this._ipc.on('@run', opt => this.runBackTest());
		this._ipc.on('@report', (data, cb) => cb(null, this.report()));

		this.onInit();
	}

	public report() {
		return {
			tickCount: this.tickCount,
			equality: this.accountManager.equality,
			orders: this.orderManager.closedOrders,
			data: this._backtestData
		};
	}

	async tick(timestamp, bid, ask): Promise<void> {
		await super.tick(timestamp, bid, ask);

		if (this.live === false) {
			this.orderManager.tick()
		}

		await this.onTick(timestamp, bid, ask);
	}

	public onTick(timestamp, bid, ask) {
		console.log('CUSTOM ONTICK SHOULD BE CALLED')
	}

	public async onInit() {
	}

	protected addOrder(orderOptions) {
		this.orderManager.add(Object.assign(orderOptions, {openTime: this.time}));
	}

	protected closeOrder(id, bid, ask) {
		this.orderManager.close(this.time, id, bid, ask)
	}

	async runBackTest(): Promise<any> {

		let count = 2000,
			candles, lastTime, lastBatch = false,
			from = this.options.from,
			until = this.options.until,
			startFetchTime;

		this._backtestData.startTime = Date.now();

		while (true) {

			startFetchTime = Date.now();

			candles = await this._ipc.send('cache', 'read', {
				instrument: this.instrument,
				timeFrame: this.timeFrame,
				from: from,
				count: count,
				bufferOnly: true
			});

			this._backtestData.totalFetchTime = Date.now() - startFetchTime;

			// There is no more data, so stop
			if (!candles.length)
				break;

			lastTime = candles[candles.length - 6];

			// See if until is reached in this batch
			if (lastTime > until) {

				// Loop to find index of last candle
				for (let i = 0, len = candles.length; i < len; i = i + 6) {
					if (candles[i] >= until) {
						candles = candles.splice(0, i - 1);
						lastBatch = true;

						break;
					}
				}
			}

			await this.inject(candles);

			// There are no more candles to end
			if (lastBatch || candles.length * 6 < count)
				break;

			from = lastTime + 1;
		}

		this._backtestData.endTime = Date.now();

		this._ipc.send('main', '@run:end', undefined, false);
	}
}
import * as _               from 'lodash';
import {ElementRef, OnInit, Input, Component, ChangeDetectionStrategy, OnDestroy} from '@angular/core';
import {InstrumentModel} from '../../models/instrument.model';

import {HighchartsDefaultTheme} from './themes/theme.default';
import './themes/theme.dark';
import {InstrumentsService} from '../../services/instruments.service';

const HighStock = require('highcharts/highstock');

@Component({
	selector: 'chart',
	exportAs: 'chart',
	styleUrls: ['./chart.component.scss'],
	templateUrl: './chart.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})

export class ChartComponent implements OnInit, OnDestroy {

	@Input() type = 'stock';
	@Input() model: InstrumentModel;
	@Input() height: number;
	@Input() offset = 0;
	@Input() chunkLength = 1500;

	private _scrollOffset = -1;
	private _scrollSpeedStep = 8;
	private _scrollSpeedMin = 1;
	private _scrollSpeedMax = 20;

	private _chart: any;
	private _onScrollBounced: Function = null;

	constructor(private _elementRef: ElementRef,
				private _instrumentsService: InstrumentsService) {
	}

	public ngOnInit() {
		// Bouncer func to limit onScroll calls
		this._onScrollBounced = _.throttle(this._onScroll.bind(this), 33);

		this._createChart();

		this.model.changed.subscribe(changes => {

			for (let key in changes) {
				if (changes.hasOwnProperty(key)) {
					switch (key) {
						case 'zoom':
							this._updateViewPort();
							break;
						case 'graphType':
							this._chart.series[0].update({
								type: changes[key]
							});
							break;
						case 'timeFrame':
							this.toggleTimeFrame(changes[key]);
							break;
						case 'indicator':
							let change = changes[key];
							if (change.type === 'add') {
								let indicator = this.model.data.indicators.find(i => i.id === change.id);

								this._updateIndicators([indicator]);
							}
							break;
					}
				}
			}
		})
	}

	public pinToCorner(edges): void {
		let el = this._chart.container;

		el.style.position = 'absolute';

		if (edges.right || edges.left) {
			el.style.left = 'auto';
			el.style.right = 0;
		}
	}

	public unpinFromCorner(reflow = true): void {
		this._chart.container.style.position = 'static';

		if (reflow)
			this.reflow();
	}

	public reflow() {
		this._updateViewPort(false);
		requestAnimationFrame(() => this._chart.reflow());
	}

	public async toggleTimeFrame(timeFrame) {
		this._toggleLoading(true);

		this._destroyChart();

		await this._instrumentsService.toggleTimeFrame(this.model, timeFrame);

		this._createChart();
	}

	private _createChart() {
		let settings = _.cloneDeep(HighchartsDefaultTheme);

		settings.series[0]['type'] = this.model.data.graphType;

		// HighStock instance
		this._chart = HighStock.stockChart(this._elementRef.nativeElement.firstElementChild, _.cloneDeep(HighchartsDefaultTheme));

		this._chart.addSeries({
			type: 'line',
			name: 'orders',
			id: 'orders',
			data: [],
			color: '#00e933',
			yAxis: 0,
			ordinal: true,
			dataGrouping: {
				enabled: false
			},
			dashStyle: 'Dash',
			marker: {
				enabled: true,
				symbol: 'circle',
				radius: 7
			},
			allowPointSelect: true
		});

		// Scroll listener
		this._chart.container.addEventListener('mousewheel', <any>this._onScrollBounced);

		// Just an empty chart
		if (!this.model)
			return;

		// Create new server instrument
		if (!this.model.data.id) {
			let subscription = this.model.synced.subscribe(() => {
				subscription.unsubscribe();

				this._fetch(this.chunkLength, this.offset);
			});
		} else {
			this._fetch(this.chunkLength, this.offset);
		}
	}

	private _updateViewPort(redraw = true, shift = 0) {
		if (!this._chart || !this._chart.series || !this._chart.series.length || !this._chart.series[0].xData.length)
			return;

		let data = this._chart.series[0].xData,
			offset = this._scrollOffset + shift,
			viewable = this._calculateViewableBars(),
			minOffset = 0,
			maxOffset = data.length - 1 - viewable,
			min, max;

		if (offset > maxOffset)
			offset = maxOffset;
		else if (offset < minOffset)
			offset = minOffset;

		this._scrollOffset = offset;

		max = data[data.length - offset];
		min = data[data.length - offset - viewable];

		this._chart.xAxis[0].setExtremes(min, max, redraw, false);
	}

	private async _fetch(count: number, offset: number) {
		this._toggleLoading(true);

		let {candles, indicators, orders} = await this._instrumentsService.fetch(this.model, count, offset);

		this._updateBars(candles);
		this._updateIndicators(indicators);
		this._updateOrders(orders);

		this._toggleLoading(false);
	}

	private _updateOrders(orders: Array<any>) {
		this._chart.get('orders').setData(orders.map(order => [order.openTime, order.bid, null]));
	}

	private _updateBars(data: any[] = []) {
		let {candles, volume} = ChartComponent._prepareData(data),
			last = candles[candles.length - 1];

		this._chart.series[0].setData(candles, false, false);
		this._chart.series[1].setData(volume, false, false);

		// Re-update viewport needed for initial batch of bars
		this._updateViewPort();

		// PlotLine cannot be delayed, so to prevent instant re-render from updateViewPort,
		// Do this after
		this._setCurrentPricePlot(last);
	}

	private _setCurrentPricePlot(bar) {
		this._chart.yAxis[0].removePlotLine('current-price');

		this._chart.yAxis[0].addPlotLine({
			value: bar[4],
			color: '#646467',
			width: 1,
			id: 'current-price',
			label: {
				text: `<div class='chart-current-price-label' style='background:white;'>${bar[4]}</div>`,
				align: 'right',
				x: 5,
				y: 2,
				style: {
					color: '#000'
				},
				useHTML: true,
				textAlign: 'left'
			}
		});
	}

	private _updateIndicators(indicators) {
		indicators.forEach(indicator => {
			for (let drawBufferName in indicator.data) {
				if (indicator.data.hasOwnProperty(drawBufferName)) {
					let drawBuffer = indicator.data[drawBufferName];

					let unique = indicator.id + '_' + drawBuffer.id;


					// New series
					let series = this._chart.get(unique);

					// Update
					if (series) {
						console.log('SERIES!!!!', series);
					}

					// Create
					else {
						switch (drawBuffer.type) {
							case 'line':
								this._chart.addSeries({
									type: drawBuffer.type,
									name: indicator.id,
									// id: unique,
									data: drawBuffer.data,
									color: drawBuffer.style.color,
									yAxis: 0,
									ordinal: true,
									dataGrouping: {
										enabled: false
									}
								});
								break;
							case 'arrow':
								alert('cannot yet draw arrow');
								break;
						}
					}
				}
			}
		});
	}

	/*
		Stop highchart from moving the Y axis so much
		TODO: improve
	 */
	private _getSurroundingPriceRange(padding = 200, viewable) {
		let data = this._chart.series[0].yData,
			i = data.length - this._scrollOffset - viewable - padding,
			len = (data.length - this._scrollOffset) + padding,
			price, low, high;

		if (i < 0)
			i = 0;

		if (len > data.length)
			len = data.length;

		for (; i < len; ++i) {
			price = data[i][0];
			if (!high || price > high) {
				high = price;
			} else if (!low || price < low) {
				low = price;
			}
		}

		return {low, high};
	}

	private _calculateViewableBars(checkParent = true) {
		let el = this._elementRef.nativeElement,
			barW = 3 * this.model.data.zoom;

		if (checkParent)
			el = el.parentNode;

		return Math.floor(el.clientWidth / barW);
	}

	private _onScroll(event: MouseWheelEvent): boolean {
		event.stopPropagation();
		event.preventDefault();

		let shift = Math.ceil(this._calculateViewableBars() / this._scrollSpeedStep);

		if (shift < this._scrollSpeedMin)
			shift = this._scrollSpeedMin;
		else if (shift > this._scrollSpeedMax)
			shift = this._scrollSpeedMax;

		this._updateViewPort(true, event.wheelDelta > 0 ? -shift : shift);

		return false;
	}

	private _toggleLoading(state) {
		requestAnimationFrame(() => this._elementRef.nativeElement.classList.toggle('loading', !!state));
	}

	static _prepareData(data: any) {
		let i = 0,
			length = data.length,
			volume = new Array(length),
			candles = new Array(length),
			candle;

		for (; i < length; i += 1) {
			candle = data[i];
			volume[i] = [
				candle[0], // Date
				candle.pop() // Volume
			];
			// TODO - Now only Bid prices - Make Ask / Bid switch in UI
			candles[i] = [candle[0], candle[1], candle[3], candle[5], candle[7]];
		}

		return {
			candles: candles,
			volume: volume
		};
	}

	private _destroyChart() {

		// Unbind scroll
		this._chart.container.removeEventListener('mousewheel', <any>this._onScrollBounced);

		// Destroy chart
		this._chart.destroy();
		this._chart = null;
	}

	public ngOnDestroy() {
		this._destroyChart();
	}
}
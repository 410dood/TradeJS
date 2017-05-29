import {
	Component, OnInit, ElementRef, QueryList, ViewChildren, ChangeDetectionStrategy
}  from '@angular/core';

import {InstrumentsService} from '../../services/instruments.service';
import {ChartBoxComponent} from '../chart-box/chart-box.component';
import {InstrumentModel} from '../../models/instrument.model';

@Component({
	selector: 'chart-overview',
	templateUrl: './chart-overview.component.html',
	styleUrls: ['./chart-overview.component.scss'],
	// changeDetection: ChangeDetectionStrategy.OnPush,
	entryComponents: [ChartBoxComponent]
})


export class ChartOverviewComponent implements OnInit {

	@ViewChildren(ChartBoxComponent) charts: QueryList<ChartBoxComponent>;

	constructor(public instrumentsService: InstrumentsService,
				private _elementRef: ElementRef) {
	}

	ngOnInit() {
		this.instrumentsService.instruments$.subscribe(instruments => {
			this.setFocusToHighestIndex();
		});

		this._setContextMenu();
	}

	tileWindows() {
		let containerH = this._elementRef.nativeElement.firstElementChild.clientHeight,
			containerW = this._elementRef.nativeElement.firstElementChild.clientWidth,
			len = this.charts.length;

		this.charts.forEach((chart, i) => {
			chart.toggleViewState('windowed');

			chart.$el.addClass('animate');

			setTimeout(() => {
				chart.$el.removeClass('animate');
			}, 400);


			if (len === 1) {
				chart.toggleViewState('stretched');
			}
			else if (len < 4) {
				let chartW = Math.floor(containerW / len);
				chart.setSize(chartW, containerH);
				chart.setPosition(0, (i * chartW) + (i * 1));
				return;
			}
		});
	}

	setFocusToHighestIndex(): void {
		if (!this.charts)
			return;

		let highest = 1,
			ref = this.charts.first;

		this.charts.forEach(chart => {
			if (chart.$el[0].style.zIndex > highest)
				ref = chart;
		});

		// this.toggleFocused(ref);
	}

	private _setContextMenu() {
		(<any>$(this._elementRef.nativeElement)).contextMenu({
			items: [
				{
					text: 'Close',
					value: 'close'
				},
				{
					text: 'Close all',
					value: 'closeAll'
				}
			],
			menuSelected: (selectedValue, originalEvent) => {
				let $button = $(originalEvent.target).parents('[data-instrument-id]'),
					id = $button.attr('data-instrument-id');

				if (id) {
					switch (selectedValue) {
						case 'close':
							this.instrumentsService.remove(this.instrumentsService.findById(id));
							break;
						case 'closeAll':
							this.instrumentsService.removeAll();
							break;
					}
				}
			}
		});
	}
}
import React from 'react';

import { Map, View } from 'ol';
import 'ol/ol.css';
import { Vector as VectorSource, XYZ } from 'ol/source';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { transform } from 'ol/proj';
import OSM from 'ol/source/OSM';
import { Draw, Select, Modify, Translate, defaults, Snap } from 'ol/interaction';
import { Style, Stroke, Fill, Icon, Circle } from 'ol/style';
import { Point, MultiPoint } from 'ol/geom';
import RotateFeatureInteraction from 'ol-rotate-feature';

import LineSegment from 'jsts/org/locationtech/jts/geom/LineSegment';
import { GeoJSONWriter, GeoJSONReader, OL3Parser } from 'jsts/org/locationtech/jts/io';

import { Button, Select as SelectUI, MenuItem } from '@material-ui/core';

import editors from '../function/editor.js';

import arrow2 from '../assets/img/mapIcon/arrow2.png';
import mapIConMerge from '../assets/img/mapIcon/mapIConMerge.png';

class Container extends React.Component {

	state = {
		map: null,
		draw: null,
		drawLyr: null,
		select: null,
		anchorEl: null,
		popupTop: null,
		popupLeft: null,
		multi: false,
	}

	componentDidMount() {
		const mangoLyr = new TileLayer({
			title: "MangoMap Grey",
			source: new XYZ({
				url: 'http://mango.iptime.org:8995/v.1.0.0/{z}/{x}/{y}.png?gray=true',
			}),
			visible: true
		})
		const osmLyr = new TileLayer({
			source: new OSM(),
		})

		const drawLyr = new VectorLayer({
			source: new VectorSource({
				wrapX: false
			}),
			style: feature => this.lineStyleFunc(feature, this.state.map),
			name: 'testLayer'
		})

		const map = new Map({
			target: 'map',
			layers: [osmLyr, drawLyr],
			view: new View({
				center: transform([process.env.REACT_APP_DEFAULT_MAP_CENTER_LON, process.env.REACT_APP_DEFAULT_MAP_CENTER_LAT], 'EPSG:4326', 'EPSG:3857'),
				zoom: process.env.REACT_APP_DEFAULT_MAP_ZOOM_LEVEL,
				minZoom: 8,
				maxZoom: 22,
				projection: 'EPSG:3857',
				interactions: defaults({})
			})
		});

		const select = new Select();

		map.addInteraction(select);
		select.on('select', this.selectFunc);
		map.getViewport().addEventListener('contextmenu', this.rightClick);
		map.on('click', () => {
			this.handleClosePopup();
			const this2 = this;
			this.state.map.getInteractions().forEach(function (interaction) {
				// 피쳐 이동 interaction 삭제
				if (interaction instanceof Translate) {
					this2.state.map.removeInteraction(interaction);
				} else if (interaction instanceof RotateFeatureInteraction) { // 피쳐 회전 interaction 삭제
					this2.state.map.removeInteraction(interaction);
				} else if(interaction instanceof Modify) { // 피쳐 수정 interaction 삭제
					this2.state.map.removeInteraction(interaction);
				}
			});
		})

		this.setState({ map, drawLyr, select });
	}

	selectFunc = (e) => {
		if (e.target.getFeatures().getArray().length > 0) {
			let type = null;
			for (let i = 0; i < e.target.getFeatures().getArray().length; i++) {
				const feature = e.target.getFeatures().getArray()[i];
				if (type === null) {
					type = feature.getGeometry().getType();
				} else if (type !== feature.getGeometry().getType()) {
					e.target.restorePreviousStyle_(e.target.getFeatures().getArray()[i]);
					e.target.getFeatures().getArray().splice(i, 1);
					e.selected.splice(0, 1);
					alert('같은 타입의 피쳐만 선택할 수 있습니다.');
					return;
				}
			}
		}
	}

	// 그리기
	drawFunc = (type) => {
		const this2 = this;
		this.state.map.getInteractions().forEach(function (interaction) {
			if (interaction instanceof Draw) {
				this2.state.map.removeInteraction(interaction);
			}
		})

		if (type) {
			this.state.map.removeInteraction(this.state.select);
			const draw = new Draw({
				source: this.state.drawLyr.getSource(),
				type
			});

			const multi = this.state.multi;
			draw.on('drawend', function (e) {
				this2.state.map.removeInteraction(this);
				this2.state.map.addInteraction(this2.state.select);
			})

			this.state.map.addInteraction(draw);

			this.handleAddSnap();

			this.setState(draw);
		}
	}

	// 스타일
	lineStyleFunc = (feature, map) => {
		let geometry = feature.getGeometry();
		//let properties = feature.getProperties();
		let styles;
		if (geometry.getType().indexOf('Point') !== -1) {
			styles = new Style({
				//point
				image: new Circle({
					radius: 8,
					fill: new Fill({
						color: 'rgba(20, 20, 255, 0.5)'
					}),
					stroke: new Stroke({
						color: 'rgba(20, 20, 255, 1)',
						width: 2
					})
				}),
			})
		} else if (geometry.getType().indexOf('LineString') !== -1) {
			styles = [
				// linestring
				new Style({
					stroke: new Stroke({
						color: 'rgba(255, 196, 20, 1)',
						width: 5
					}),
					fill: new Fill({
						color: 'rgba(255, 196, 20, 0.1)'
					})
				})
			];
		} else {
			styles = [
				// polygon
				new Style({
					stroke: new Stroke({
						color: 'rgba(255, 255, 255, 1)',
						width: 5
					}),
					fill: new Fill({
						color: 'rgba(255, 255, 255, 0.1)'
					})
				})
			];
		}

		// MultiLineString 스타일(화살표)
		if (geometry.getType().indexOf('MultiLineString') !== -1) {
			geometry.getCoordinates().forEach(function (coord) {
				for (let i = 0; i < coord.length - 1; i++) {
					const dx = coord[i + 1][0] - coord[i][0];
					const dy = coord[i + 1][1] - coord[i][1];
					let rotation = Math.atan2(dy, dx);

					const reader = new GeoJSONReader();
					const point1 = reader.read({ type: 'Point', coordinates: coord[i] });
					const point2 = reader.read({ type: 'Point', coordinates: coord[i + 1] });

					let midpoint = new LineSegment(point1.getCoordinates()[0], point2.getCoordinates()[0]).midPoint();
					styles.push(new Style({
						geometry: new Point([midpoint.x, midpoint.y]),
						image: new Icon({
							src: arrow2,
							anchor: [0.75, 0.5],
							rotateWithView: true,
							rotation: -rotation
						})
					}));
				}
			});
			// LineString 스타일(화살표)
		} else if (geometry.getType().indexOf('LineString') !== -1) {
			geometry.forEachSegment(function (start, end) {
				var dx = end[0] - start[0];
				var dy = end[1] - start[1];
				var rotation = Math.atan2(dy, dx);
				// arrows
				const reader = new GeoJSONReader();
				const point1 = reader.read({ type: 'Point', coordinates: start });
				const point2 = reader.read({ type: 'Point', coordinates: end });

				let midpoint = new LineSegment(point1.getCoordinates()[0], point2.getCoordinates()[0]).midPoint();

				styles.push(new Style({
					geometry: new Point([midpoint.x, midpoint.y]),
					image: new Icon({
						src: arrow2,
						anchor: [0.75, 0.5],
						rotateWithView: true,
						rotation: -rotation
					})
				}));
			});

		}

		return styles;
	}

	//피쳐 회전 스타일
	createRotateStyle = () => {
		let styles = {
			anchor: [],
			arrow: []
		}
		return function (feature, resolution) {
			let style;
			let angle = feature.get('angle') || 0;
			switch (true) {
				case feature.get('rotate-anchor'):
					style = styles['anchor'];
					return style
				case feature.get('rotate-arrow'):
					style = styles['arrow'];
					return style;
			}
		}
	}

	// 오른쪽 클릭 팝업 이벤트
	rightClick = (e) => {
		e.preventDefault();
		let clickEvent = this.state.map.forEachFeatureAtPixel(this.state.map.getEventPixel(e),
			function (feature, layer) {
				return { feature, layer };
			});


		this.state.map.getInteractions().forEach(function (interaction) {
			if (interaction instanceof Modify) {
				alert('수정 종료후 다시 시도');
				clickEvent = null;
			}
		});

		if (clickEvent && clickEvent.layer !== null) {
			const feature = clickEvent.feature;
			let vectorLayer = clickEvent.layer;
			let select = this.state.select;
			let popupTop = null;
			let popupLeft = null;

			if (select && select.getFeatures().getArray().length > 1) {

			} else if (select) {
				select.getFeatures().clear();
				select.getFeatures().push(feature); //select에 넣어주기
			}


			//오른쪽 버튼 popup open 및 위치
			const anchorEl = e.currentTarget;
			if (feature.getGeometry().getType().indexOf('Polygon') !== -1) {
				popupTop = e.clientY - 70;
			} else {
				popupTop = e.clientY - 70;
			}
			popupLeft = e.clientX;

			this.setState({ anchorEl, popupTop, popupLeft });
		}
	}

	//오른쪽 클릭 popup 닫기
	handleClosePopup = () => {
		const select = this.state.select;
		//select.getFeatures().clear(); 
		this.setState({ anchorEl: null, select });
	};

	// 피쳐 이동
	handleFeatureMove = () => {
		this.handleClosePopup();
		editors.featureMove(this.state.map, this.state.select.getFeatures().getArray());
	}

	// 피쳐 회전
	handleFeatureRotate = (map, features) => {
		this.handleClosePopup();
		editors.rotate(map, features, this.createRotateStyle());
	}

	handleFeatureStraight = (features) => {
		this.handleClosePopup();
		for (let item of features) {
			editors.lineStraight(item);
		}
	}

	handleFeatureReverse = (features) => {
		this.handleClosePopup();
		for (let item of features) {
			editors.lineReverse(item);
		}
	}

	handleFeatureSimplify = (features) => {
		this.handleClosePopup();
		for (let item of features) {
			editors.simplify(item);
		}
	}

	handleFeatureReflect = (type, features) => {
		this.handleClosePopup();
		for (let item of features) {
			editors.reflect(type, item);
		}
	}

	handleFeatureSplit = (type, feature) => {
		this.handleClosePopup();
		if (type.indexOf('LineString') !== -1) {
			editors.lineSplit(feature, this.state.map);
		} else if (type.indexOf('Polygon') !== -1) {
			editors.polygonSplit(feature, this.state.map, this.state.select);
		}
	}

	handleFeatureMerge = (type, features) => {
		this.handleClosePopup();
		if (type.indexOf('Point') !== -1) {
			editors.pointMerge(features, this.state.map);
		} else if (type.indexOf('LineString') !== -1) {
			editors.lineStringMerge(features, this.state.map);
		} else if (type.indexOf('Polygon') !== -1) {
			editors.polygonMerge(features, this.state.map);
		}
	}

	handleFeatureNodeSplit = (features) => {
		this.handleClosePopup();
		for (let item of features) {
			editors.lineNodeSplit(item, this.state.map);
		}
	}

	handleDelete = (features) => {
		this.handleClosePopup();
		for (let item of features) {
			editors.deleteFeature(item, this.state.map);
		}
	}

	handleFeatureEdit = (features) => {
		this.handleClosePopup();
		
		const modify = new Modify({
			features
		});
		this.state.map.addInteraction(modify);

		this.handleAddSnap();
	}

	// snap 이벤트
	handleAddSnap = () => {
		const this2 = this;
		this.state.map.getInteractions().forEach(function (interaction) {
			if(interaction instanceof Snap) {
				this2.state.map.removeInteraction(interaction);
			}
		})

		const snap = new Snap({
			source: this.state.drawLyr.getSource()
		})

		this.state.map.addInteraction(snap);
	}

	render() {
		const editToolOpen = Boolean(this.state.anchorEl);
		return (
			<>
				<div
					id="map"
					style={{
						width: "100%",
						height: "100%",
					}}>
				</div>
				<div style={{ position: 'absolute', top: 20, left: '37.5%', backgroundColor: 'rgba(158, 148, 152, 0.72)', width: '25%' }}>
					<Button variant="contained" color="primary" style={{ margin: 5 }} onClick={(e) => this.drawFunc(this.state.multi ? 'MultiPoint' : 'Point')}>Point</Button>
					<Button variant="contained" color="primary" style={{ margin: 5 }} onClick={(e) => this.drawFunc(this.state.multi ? 'MultiLineString' : 'LineString')}>LineString</Button>
					<Button variant="contained" color="primary" style={{ margin: 5 }} onClick={(e) => this.drawFunc(this.state.multi ? 'MultiPolygon' : 'Polygon')}>Polygon</Button>
					<SelectUI
						labelId="demo-simple-select-label"
						id="demo-simple-select"
						value={this.state.multi}
						onChange={(e) => { this.setState({ multi: e.target.value }) }}
					>
						<MenuItem value={false}>Single</MenuItem>
						<MenuItem value={true}>Multi</MenuItem>
					</SelectUI>
				</div>
				<ul
					className="contextMenuIcon"
					style={{ display: editToolOpen ? 'block' : 'none', top: this.state.popupTop, left: this.state.popupLeft }}
				>
					{
						// 라인일 때 편집
						this.state.select !== null
							&& this.state.select.getFeatures().getArray().length > 0
							&& this.state.select.getFeatures().getArray()[0].getGeometry().getType().indexOf('LineString') !== -1 ?
							<>
								<li onClick={() => this.handleFeatureStraight(this.state.select.getFeatures().getArray())}>
									직선화
								</li>
								<li onClick={() => this.handleFeatureReverse(this.state.select.getFeatures().getArray())}>
									방향반전
								</li>
								<li onClick={() => this.handleFeatureNodeSplit(this.state.select.getFeatures().getArray())}>
									노드별 분할
								</li>
							</>
							: null}
					{
						// 폴리곤, 라인일 때 편집 기능
						this.state.select !== null
							&& this.state.select.getFeatures().getArray().length > 0
							&& this.state.select.getFeatures().getArray()[0].getGeometry().getType().indexOf('Point') === -1 ?
							<>
								<li onClick={() => this.handleFeatureSimplify(this.state.select.getFeatures().getArray())}>
									단순화
								</li>
								<li onClick={() => this.handleFeatureReflect('short', this.state.select.getFeatures().getArray())}>
									짧은축 반전
								</li>
								<li onClick={() => this.handleFeatureReflect('long', this.state.select.getFeatures().getArray())}>
									긴축 반전
								</li>
								<li onClick={this.handleFeatureMove}>
									이동
								</li>
							</>
							: null}
					{
						this.state.select !== null
							&& this.state.select.getFeatures().getArray().length === 1
							&& this.state.select.getFeatures().getArray()[0].getGeometry().getType().indexOf('Point') === -1 ?
							<>
								<li onClick={() => this.handleFeatureRotate(this.state.map, this.state.select.getFeatures().getArray())}>
									회전
								</li>
								<li onClick={() => this.handleFeatureSplit(this.state.select.getFeatures().getArray()[0].getGeometry().getType(), this.state.select.getFeatures().getArray()[0])}>
									분할
								</li>
							</>
							: null}
					{
						// 2개 이상의 피쳐(같은 geometry type) 일 때 편집 
						this.state.select !== null
							&& this.state.select.getFeatures().getArray().length > 1
							?
							<li onClick={() => this.handleFeatureMerge(this.state.select.getFeatures().getArray()[0].getGeometry().getType(), this.state.select.getFeatures().getArray())}>
								병합
							</li>
							// 공통
							: null}
					{
						this.state.select !== null
							&& this.state.select.getFeatures().getArray().length > 0
							&& this.state.select.getFeatures().getArray()[0].getGeometry().getType() === 'MultiPoint' ?
							<li>
								분할
							</li>
							: null
					}
					{
						this.state.select !== null
							&& this.state.select.getFeatures().getArray().length === 1 ?
							<li onClick={() => this.handleFeatureEdit(this.state.select.getFeatures())}>
								수정
							</li>
							: null}
					<li onClick={() => this.handleDelete(this.state.select.getFeatures().getArray())}>
						삭제
					</li>
				</ul>
			</>
		)
	}
}

export default Container;
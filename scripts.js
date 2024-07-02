const vworldKey = `${apiKey}`;

let mapStyles = {
    base: new ol.layer.Tile({
        title: 'VWorld Base Map',
        visible: true,
        source: new ol.source.XYZ({
            url: `http://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Base/{z}/{y}/{x}.png`
        })
    }),
    white: new ol.layer.Tile({
        title: 'VWorld White Map',
        visible: false,
        source: new ol.source.XYZ({
            url: `http://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/white/{z}/{y}/{x}.png`
        })
    }),
    night: new ol.layer.Tile({
        title: 'VWorld Night Map',
        visible: false,
        source: new ol.source.XYZ({
            url: `http://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/midnight/{z}/{y}/{x}.png`
        })
    }),
    hybrid: new ol.layer.Tile({
        title: 'VWorld Hybrid Map',
        visible: false,
        source: new ol.source.XYZ({
            url: `http://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Hybrid/{z}/{y}/{x}.png`
        })
    })
};

let currentMapStyle = 'base';

const map = new ol.Map({
    target: 'map',
    layers: [
        mapStyles.base,
        mapStyles.white,
        mapStyles.night,
        mapStyles.hybrid
    ],
    view: new ol.View({
        center: ol.proj.transform([126.925535, 37.525101], 'EPSG:4326', 'EPSG:3857'),
        zoom: 13,
        minZoom: 7, // 최소 줌 레벨
        maxZoom: 19 // 최대 줌 레벨
    }),
    controls: ol.control.defaults().extend([
        new ol.control.ZoomSlider(),
        new ol.control.ScaleLine({
            target: 'scale-line',
            units: 'metric'
        })
    ])
});

map.getControls().forEach(function (control) {
    if (control instanceof ol.control.ZoomSlider) {
        control.setTarget(document.getElementById('map-container'));
    }
});

let features = [];
let styleCache = [];

let search = function () {
    const searchValue = document.getElementById("searchValue");
    if (searchValue.value === "") {
        alert('검색 내용이 없습니다.');
        return false;
    }

    $.ajax({
        type: "get",
        url: "http://api.vworld.kr/req/search",
        data: $('#searchForm').serialize(),
        dataType: 'jsonp',
        async: false,
        success: function (data) {
            let searchResults = $('#searchResults');
            searchResults.empty(); // 기존 결과를 지우기

            features = []; // 기존 피처를 초기화

            for (let o in data.response.result.items) {
                if (o == 0) {
                    move(data.response.result.items[o].point.x * 1, data.response.result.items[o].point.y * 1);
                }

                // 검색 결과를 li 태그로 변환하여 ul에 추가
                let item = data.response.result.items[o];
                let listItem = $(`<li onclick="move(${item.point.x}, ${item.point.y}, 1)"><strong>${item.title}</strong> <p>${item.address.road || item.address.parcel}</p></li>`);
                searchResults.append(listItem);

                // Feature 객체에 저장하여 활용 
                features[o] = new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.transform([item.point.x * 1, item.point.y * 1], 'EPSG:4326', "EPSG:3857")),
                    title: item.title,
                    parcel: item.address.parcel,
                    road: item.address.road,
                    category: item.category,
                    point: item.point
                });
                features[o].set("id", item.id);

                let iconStyle = new ol.style.Style({
                    image: new ol.style.Icon({
                        anchor: [0.5, 10],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'pixels',
                        src: 'http://map.vworld.kr/images/ol3/marker_blue.png'
                    })
                });
                features[o].setStyle(iconStyle);
            }

            let vectorSource = new ol.source.Vector({
                features: features
            });

            let vectorLayer = new ol.layer.Vector({
                source: vectorSource
            });

            vectorLayer.set("vectorLayer", "search_vector");

            map.getLayers().forEach(function (layer) {
                if (layer.get("vectorLayer") == "search_vector") {
                    map.removeLayer(layer);
                }
            });
            map.addLayer(vectorLayer);

            console.log(data.response.result.items.length);
            const resCnt = document.getElementById('res-cnt');
            resCnt.innerText = data.response.result.items.length;
        },
        error: function (xhr, stat, err) {}
    });
}

let move = function (x, y, mode = 0) {
    let _center = ol.proj.transform([x, y], 'EPSG:4326', "EPSG:3857");
    map.getView().setCenter(_center);
    setTimeout(fnMoveZoom(mode), 500);
}

function fnMoveZoom(mode) {
    let zoom = map.getView().getZoom();
    if (zoom < 14) { // 검색을 한 경우
        map.getView().setZoom(14);
    }
    if (mode) { // li 눌러서 해당 위치를 자세히 보는 경우
        map.getView().setZoom(18);
    }
}

map.on("click", function (evt) {
    let pixel = evt.pixel;

    map.forEachFeatureAtPixel(pixel, function (feature) {
        const title = feature.get("title"); // 이름 정보 
        const address = feature.get("road") || feature.get("parcel"); // 주소 정보

        if (title) {
            var overlayElement = document.createElement("div");
            overlayElement.setAttribute("class", "overlayElement");
            overlayElement.setAttribute("style", "background-color: #3399CC; border: 2px solid white; color:white");
            overlayElement.setAttribute("onclick", "deleteOverlay('" + feature.get("id") + "')");
            overlayElement.innerHTML = `<strong>${title}</strong><p>주소 : ${address}</p>`; // 이름, 주소 정보 출력

            let overlayInfo = new ol.Overlay({
                id: feature.get("id"),
                element: overlayElement,
                offset: [0, -70],
                position: ol.proj.transform([feature.get("point").x * 1, feature.get("point").y * 1], 'EPSG:4326', "EPSG:3857")
            });

            if (feature.get("id") != null) {
                map.removeOverlay(map.getOverlayById(feature.get("id")));
            }

            map.addOverlay(overlayInfo);
        }
    });
});


let deleteOverlay = function (id) {
    map.removeOverlay(map.getOverlayById(id));
}

// Update zoom level display
const zoomLevelElement = document.getElementById('zoom-level');
const updateZoomLevel = () => {
    zoomLevelElement.innerText = 'Zoom: ' + map.getView().getZoom().toFixed(2);
};

map.getView().on('change:resolution', updateZoomLevel);
updateZoomLevel();

// Function to change map style based on button click
function changeMapStyle(style) {
    currentMapStyle = style;

    // 모든 레이어 숨기기
    for (let key in mapStyles) {
        mapStyles[key].setVisible(false);
    }

    // 선택된 스타일 레이어 보이기
    mapStyles[style].setVisible(true);
}

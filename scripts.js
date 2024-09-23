(function() {
    const vworldKey = '5AED84E4-C740-3AAA-B50B-09ED73DCDF2F';
    const searchValue = document.getElementById("searchValue");
    let page = 1; // 검색 리스트 페이징
    let size = 10; // 검색 리스트 페이징 사이즈
    let bbox = ''; // 현재 화면에서 보이는 지도 좌표 저장 변수
    let totCnt = 0 // 검색 데이터 수
    let totalPages = 0; // 총 페이지 수

    searchValue.addEventListener("keyup", (event) => {
        if (event.key === "Enter") {
            search();
        }
    });

    let mapStyles = {
        base: new ol.layer.Tile({
            title: 'VWorld Base Map',
            visible: true,
            source: new ol.source.XYZ({
                url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Base/{z}/{y}/{x}.png`
            })
        }),
        white: new ol.layer.Tile({
            title: 'VWorld White Map',
            visible: false,
            source: new ol.source.XYZ({
                url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/white/{z}/{y}/{x}.png`
            })
        }),
        night: new ol.layer.Tile({
            title: 'VWorld Night Map',
            visible: false,
            source: new ol.source.XYZ({
                url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/midnight/{z}/{y}/{x}.png`
            })
        }),
        satellite: new ol.layer.Tile({
            title: 'VWorld Hybrid Map',
            visible: false,
            source: new ol.source.XYZ({
                url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Satellite/{z}/{y}/{x}.jpeg`
            })
        }),
        hybrid: new ol.layer.Tile({
            title: 'VWorld Hybrid Map',
            visible: false,
            source: new ol.source.XYZ({
                url: `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Hybrid/{z}/{y}/{x}.png`
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
            mapStyles.satellite,
            mapStyles.hybrid
        ],
        view: new ol.View({
            center: ol.proj.transform([126.925535, 37.525101], 'EPSG:4326', 'EPSG:3857'),
            zoom: 13, // 초기 줌 레벨
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
    let query = ''
    function search(type) {
        if (type !== 'page') {
            query = searchValue.value
            page = 1
        }

        if (!query) {
            alert('검색 내용이 없습니다.');
            return false;
        }

        const data = {
            page: page,
            type: "PLACE",
            size: size,
            request: "search",
            bbox: bbox,
            apiKey: vworldKey,
            query: query
        }
        
        const serializedData = Object.keys(data)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
            .join('&');

        $.ajax({
            type: "get",
            url: "https://api.vworld.kr/req/search",
            data: serializedData,
            dataType: 'jsonp',
            async: false,
            success: function (data) {
                let searchResults = $('#searchResults');
                searchResults.empty(); // 기존 결과를 지우기

                features = []; // 기존 피처를 초기화
                console.log(data)
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
                            src: 'https://map.vworld.kr/images/ol3/marker_blue.png'
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

                searchValue.value = ''

                console.log(data.response.result.items.length);
                const resCnt = document.getElementById('res-cnt');
                totCnt = data.response.record.total;
                resCnt.innerText = totCnt;

                totalPages = Math.ceil(totCnt / size); // 총 페이지 수 계산
                console.log(`Total items: ${totCnt}, Total pages: ${totalPages}`);

                renderPagination()
            },
            error: function (xhr, stat, err) {}
        });
    }

    function move(x, y, mode = 0) {
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

    // 마커를 클릭했을 경우
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

    function deleteOverlay(id) {
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
        if (style === 'satellite') {
            mapStyles['satellite'].setVisible(true);
            mapStyles['hybrid'].setVisible(true);  // hybrid layer is also shown on top
        } else {
            mapStyles[style].setVisible(true);
        }
    }

    // 지도 뷰포트의 범위 (extent)를 구하고 이를 EPSG:4326 좌표계로 변환하는 함수
    function getCurrentExtent() {
        // 현재 뷰포트의 범위 구하기 (EPSG:3857 좌표계)
        const extent = map.getView().calculateExtent(map.getSize());
        // EPSG:3857에서 EPSG:4326으로 범위를 변환하기
        const transformedExtent = ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
        
        // 범위를 각각 최대 및 최소 위도, 경도로 분리
        const [minX, minY, maxX, maxY] = transformedExtent;
        // const minXY = ol.proj.transform([minX, minY], 'EPSG:4326', 'EPSG:3857')
        // const maxXY = ol.proj.transform([maxX, maxY], 'EPSG:4326', 'EPSG:3857')
        // const minX3857 = minXY[0]
        // const minY3857 = minXY[1]
        // const maxX3857 = maxXY[0]
        // const maxY3857 = maxXY[1]
        return {
            minLongitude: minX,
            minLatitude: minY,
            maxLongitude: maxX,
            maxLatitude: maxY
        };
    }

    function getCurrentExtentString() {
        const extent = getCurrentExtent();
        return `${extent.minLongitude},${extent.minLatitude},${extent.maxLongitude},${extent.maxLatitude}`;
    }

    // getCurrentExtentString을 list로 변환
    function getCurrentExtentList() {
        const extentString = getCurrentExtentString();
        return extentString.split(',').map(Number); // 각 값을 숫자로 변환
    }

    // Document ready
    $(document).ready(function () {
        // checkbox 상태 변화 감지를 위한 이벤트 리스너 추가
        const checkbox = document.getElementById('ck');
        checkbox.addEventListener('change', function () {
            if (checkbox.checked) { // checkbox가 선택되었을 때
                bbox = getCurrentExtentString(); // 현재 화면에서 보이는 지도 좌표값 저장
                // console.log('Checkbox is checked');  
            } else { // checkbox가 해제되었을 때
                bbox = ''; // 좌표값 제거
                // console.log('Checkbox is not checked');
            }
        });

        // 화면이 변할 때 마다 check가 선택 되있으면 bbox 값 갱신
        map.on('moveend', () => {
            if (checkbox.checked) {
                bbox = getCurrentExtentString();
                // console.log(bbox);
            }
            // const lonLat = getCurrentExtentList()
            // console.log('Updated Min Longitude:', lonLat[0]);
            // console.log('Updated Min Latitude:', lonLat[1]);
            // console.log('Updated Max Longitude:', lonLat[2]);
            // console.log('Updated Max Latitude:', lonLat[3]);
            // console.log('-------------------------------');
        });
    });

    // 페이지 내비게이션 (5개씩 보여주는 방식)
    function renderPagination() {
        let pagination = $('#pagination');
        pagination.empty();  // 기존 페이지 버튼을 지움

        const startPage = Math.floor((page - 1) / 5) * 5 + 1;
        const endPage = Math.min(startPage + 4, totalPages);

        for (let i = startPage; i <= endPage; i++) {
            let pageButton = $('<button class="page-btn"></button>').text(i);
            if (i === page) {
                pageButton.css({
                    'background-color': '#007bff',
                    'color' : 'white'
                });
            }

            pageButton.on('click', function () {
                page = i;
                search('page');  // 해당 페이지로 검색
            });

            pagination.append(pageButton);
        }

        // 페이징 이전/다음 버튼 처리
        if (startPage > 1) {
            let prevButton1 = $('<button class="page-btn"></button>').text('<<').on('click', function () {
                page = startPage - 1;
                search('page');
            });
            // let prevButton2 = $('<button class="page-btn"></button>').text('<').on('click', function () {
            //     page = page - 1;
            //     search('page');
            // });
            // pagination.prepend(prevButton2);
            pagination.prepend(prevButton1);
        }

        if (endPage < totalPages) {
            let nextButton1 = $('<button class="page-btn"></button>').text('>>').on('click', function () {
                page = endPage + 1;
                search('page');
            });
            // let nextButton2 = $('<button class="page-btn"></button>').text('>').on('click', function () {
            //     page = page + 1;
            //     search('page');
            // });
            // pagination.append(nextButton2);
            pagination.append(nextButton1);
        }
    }

    // 사이드바 숨김/보임 처리
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleButton = document.getElementById('toggleSidebar');

        if (sidebar.style.display === 'none' || sidebar.style.display === '') {
            sidebar.style.display = 'block'; // 사이드바 보이기
            toggleButton.innerText = '사이드바 숨기기';
        } else {
            sidebar.style.display = 'none'; // 사이드바 숨기기
            toggleButton.innerText = '사이드바 보이기';
        }
    }

    window.search = search; // 검색
    window.changeMapStyle = changeMapStyle; // 지도 모드
    window.move = move; // 검색 li 클릭 이동
    window.deleteOverlay = deleteOverlay
    window.toggleSidebar = toggleSidebar
}())
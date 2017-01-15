"use strict";

// в задачи этого кода входит преобразование JSON объектов в human-читаемый текст с характеристиками

function MobjInfoParser() {

    var _this = this;

    // с помощью этого хелпера можно понять, например, что square это "общая площадь" (типа locales/ru.yml)
    var _i18n = null;

    // todo-clear22:: необходимо сбрасывать это значение после того, как сбросили поиск
    // текущий результат поиска - какие полигоны площадей соответствуют поиску и содержат искомые магазины
    var _sresults_areas = null;

    // используется в _row_area
    var _row_area_pattern = "<li><a href='{HREF}' title='{TITLE}' target='_blank'>{TITLE}</a> ({AREA_TITLE}), {PHONE}</li>";

    //--[ public ]------------------------------------------------------------------------------------------------------

    /**
     * Лабаем html текст из json-данных полигона Этажа/Здания/Площади.
     *
     * @param json
     */
    this.makeHtmlText = function (json) {
        console.log("<MobjInfoParser.makeHtmlText> Лабаем html текст из json данных полигона.");

        var result = "";

        //#-> предполагается, что json в поряде и данные целостны (т.е. уровнем выше была проверка json на корректность)
        switch (json["class_name"]) {
            case "C80MapFloors::Floor":

                /* [aa34qq] json:
                {
                    <...свойства картинки этажа, чисто класс C80MapFloors::Floor..>

                    "areas": [                                              // полигоны площадей этой картинки этажа
                                {  "id": 5,
                                    <...C80MapFloors::Floor..>

                                    "data": {                               // данные привязанной к плоигону Площади
                                        "id": 9,
                                        "title": "Дом-1",
                                        "square": null,
                                        "desc": "",
                                        "price_string": null,
                                        "communications": null,
                                        "is_free": false,
                                        "shop": {                           // данные Магазина, который занимает эту Площадь
                                            "id": 130,
                                            "title": "ИП Кибардин",
                                            "desc": "",
                                            "tel": "(910) 514 08 68",
                                            "site": "",
                                            "url": "/shops/ip-kibardin.html"
                                        }
                                    }
                                },
                    ],

                    "data":                                                 // данные Этажа, привязанного к картинке этажа
                        "id": 40,
                        "ord": 1,
                        "title": "1 этаж",
                        "square": 0.0,
                        "square_free": 0.0,
                        "areas_count": 2,
                        "areas_free_count": 2,
                        "price_string": "от  до  руб./кв.м",
                        "floor_height": null,
                        "communications": ""
                    }
                }*/

                /* [aa34qq] или сокращённо
                json:
                {
                    "areas": [                                              // полигоны площадей этой картинки этажа
                                {  "id": 5,

                                    "data": {                               // данные привязанной к плоигону Площади
                                        "id": 9,
                                        "title": "Дом-1",
                                        "is_free": false,
                                        "shop": {                           // данные Магазина, который занимает эту Площадь
                                            "id": 130,
                                            "title": "ИП Кибардин",
                                        }
                                    }
                                },
                    ],

                    "data":                                                 // данные Этажа, привязанного к картинке этажа
                        "id": 40,
                        "title": "1 этаж",
                    }
                }
                */

                // при наличии результатов поиска
                if (_sresults_areas != null) {

                    //<editor-fold desc="// посмотрим, нету ли в json полигонов площадей, чьи айдишники перечислены в _sresults_areas">

                        // подготовительно: соберём айдишники полигонов площадей в отдельный массив
                        var arr_map_areas_ids = $.map(json['areas'], function (val, index) {
                            return val['id'];
                        });

                        console.log('<MobjInfoParser.makeHtmlText> В массиве [' + arr_map_areas_ids.join(', ') +'] ищем элементы: [' + _sresults_areas.join(', ') + '].');

                        //<editor-fold desc="// 1. переберём айдишники из _sresults_areas и поищем их в arr_json_areas_ids.">
                        /* результат (индексы объектов для отображения из массива json['areas']) соберём в массиве [**] */

                        var i, len = _sresults_areas.length;
                        var i_search_index; // индекс айдишника `искомой пользователем полигона площади` в массиве json['areas'] полигонов площадей (просматриваемого этажа)
                        var isaid; // iterated searched area's id
                        var arr_search_indexes = []; // [**] - индексы объектов полигонов площадей просматриваемого этажа (для отображения в инфо панели) из массива json['areas']

                        for (i=0; i<len; i++) {
                            isaid = _sresults_areas[i];
                            i_search_index = arr_map_areas_ids.indexOf(isaid);
                            // если в map-массиве полигонов площадей просматриваемого этажа обнаружен айдишник `искомой пользователем площади`
                            if (i_search_index != -1) {
                                console.log('<MobjInfoParser.makeHtmlText> В массиве [' + arr_map_areas_ids.join(', ') +'] обнаружен ' + isaid + '.');
                                // запомним каждый i_search_index (затем я намереваюсь обработать их в отдельном цикле: найти соответствующие данные полигонов площадей (просматриваемого этажа) в массиве json['areas'], и собрать html-сроки для каждого объекта с данными в один список
                                arr_search_indexes.push(i_search_index);
                            }
                        }
                        //</editor-fold>

                        //<editor-fold desc="// 2. Теперь переберём найденные индексы, собирая по ходу html-строки для отображения">

                        len = arr_search_indexes.length;
                        // если на этаже есть площади, удовлетворяющие поиску
                        if (len > 0) {
                            var i_json_area;
                            // переберём индексы
                            for (i=0; i<len; i++) {

                                // зафиксируем индекс и соотв. данные
                                i_search_index = arr_search_indexes[i];
                                i_json_area = json['areas'][i_search_index];

                                //#-> если всё в порядке (есть данные полигона площади по этому индексу) - лабаем из них html-строку
                                if (i_json_area != undefined) {
                                    result += _this._row_area(i_json_area);
                                }

                                // иначе - сообщим об ошибке в лог
                                else {
                                    console.log('<MobjInfoParser.makeHtmlText> [ERROR] Вроде индекс есть ('+i_search_index+'), а данных по этому адресу не нашлось...');
                                }
                            }
                        }

                        // если же на этаже нету результатов, удовлетворяющих поиску
                        else {
                            // "просто отобразим данные об этаже согласно режиму"
                            result = _this._makeHtmlText_Umode_Floor(json);
                        }


                        //</editor-fold>

                    //</editor-fold>

                }

                // если это не поиск
                else {
                    // "просто отобразим данные об этаже согласно режиму"
                    result = _this._makeHtmlText_Umode_Floor(json);
                }

            break;
        }

        result = "<ul>" + result + "</ul>";
        return result;

    };

    /**
     * Задаём текущие результаты поиска (вызывается из BuildingInfo).
     * @param sresult_areas
     */
    this.setSearchResultAreas = function (sresult_areas) {
        _sresults_areas = sresult_areas;
    };

    //--[ private ]-----------------------------------------------------------------------------------------------------

    /**
     * На основе режима пользователя карты (Арендатор или ОбычныйПокупатель) выдать html-строку с `просто данными` об Этаже.
     *
     * @param json_floor - данные полигона этажа от C80MapFloors::Floor.my_as_json (пример можно лицезреть в [aa34qq]
     * @returns {string} - html-строка, которая завернётся в <ul>...</ul>
     * @private
     */
    this._makeHtmlText_Umode_Floor = function (json_floor) {

        var result = '';

        // todo-umode:: на основе режима пользователя карты (Арендатор или ОбычныйПокупатель) отрисовать `просто данные` об Этаже

        //<editor-fold desc=" // отобразим данные Этажа: метраж, кол-во площадей, коммуникации, цена за кв.м (режим Арендатора)">
        result += _this._row('square', json_floor);
        result += _this._row('square_free', json_floor);
        //result += _this._row('floor_height', json);
        result += _this._row('communications', json_floor);
        result += _this._row('areas_count', json_floor);
        result += _this._row('areas_free_count', json_floor);
        result += _this._row('price_string', json_floor);
        //</editor-fold>

        return result;
    };

    /**
     * Соорудить html-строку для списка свойств Этажа.
     * @param key
     * @param json
     * @returns {string}
     * @private
     */
    this._row = function (key, json) {
        var s = '';
        if (key == 'price_string') {
            s = "<li class='price'>" + json['data'][key] + "</li>";
        } else {
            s = "<li>" + _i18n.t(key) + ": " + "<span class='dd'>" + json['data'][key] + "</span>" + "</li>"
        }
        return s;
    };

    /**
     * Выдать человекочитаемую html-строку <li>...</li>, которая описывает искомый Магазин.
     * Этот служебный метод является контейнером кода, который желательно использовать только в makeHtmlText.
     *
     * @param area_json - данные об полигоне площади, сформированные методом C80MapFloors::Area.my_as_json4
     * @returns {string} - <li><a href='' title='' target='_blank'>Магазин такой-то</a>(площадь такая-то), телефоны<li>
     * @private
     *
     */
    this._row_area = function (area_json) {
        var res = '[ERROR] Нет данных о магазине в полигоне площади с id='+area_json['id'];
        if (area_json['data'] != undefined && area_json['data']['shop'] != undefined) {
            var shop = area_json['data']['shop'];
            res = _row_area_pattern;
            res = res.split('{TITLE}').join(shop['title']);
            res = res.split('{HREF}').join(shop['url']);
            res = res.split('{PHONE}').join(shop['tel']);
            res = res.split('{AREA_TITLE}').join(area_json['data']['title']);
        }
        return res;
    };

    //--[ init ]--------------------------------------------------------------------------------------------------------

    var _fInit = function () {

        // кастуем locales-помощника
        _i18n = new I18n();

    };

    _fInit();
}
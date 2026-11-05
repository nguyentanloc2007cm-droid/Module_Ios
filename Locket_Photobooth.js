// ========= Locket Photobooth Edge-to-Edge & 4-Shot Engine ========= //
(function () {
    const TWO_PASS_CONFIGS = [
        { idx: 1, matches: ["pb_strawberry", "frame_berry_days"], pass1Id: "photobooth_cute", targetFid: "pb_strawberry", cx: 24, cy: 24, cw: 1032, ch: 1032 },
        { idx: 2, matches: ["pb_vintage", "frame_happy_snap"], pass1Id: "photobooth_cute", targetFid: "pb_vintage", cx: 24, cy: 24, cw: 1032, ch: 1032 },
        { idx: 3, matches: ["pb_galaxy", "frame_sky_diary"], pass1Id: "photobooth_cute", targetFid: "pb_galaxy", cx: 24, cy: 24, cw: 1032, ch: 1032 },
        { idx: 4, matches: ["pb_holo"], pass1Id: "photobooth_cute", targetFid: "pb_holo_4Cut", cx: 118, cy: 110, cw: 857, ch: 860 },
        { idx: 5, matches: ["pb_scrapbook"], pass1Id: "photobooth_cute", targetFid: "pb_scrapbook_ripped_4Cut", cx: 75, cy: 70, cw: 930, ch: 930 },
        { idx: 6, matches: ["pb_ripped_paper"], pass1Id: "photobooth_cute", targetFid: "pb_ripped_paper_4Cut", cx: 68, cy: 65, cw: 944, ch: 948 }
    ];

    const SINGLE_CROP_CONFIGS = [
        { idx: 7, matches: ["pb_denim_ripped_2x2"], pass1Id: "pb_denim_ripped_2x2", cx: 66, cy: 66, cw: 948, ch: 948 },
        { idx: 8, matches: ["photoboot", "frame_classic_pb"], exact: true, pass1Id: "photoboot", cx: 16, cy: 16, cw: 1048, ch: 1048 },
        { idx: 9, matches: ["pb_single_denim_ripped"], pass1Id: "pb_single_denim_ripped", cx: 28, cy: 28, cw: 1024, ch: 1024 },
        { idx: 10, matches: ["pb_single_film_nostalgia"], pass1Id: "pb_single_film_nostalgia", cx: 26, cy: 32, cw: 1028, ch: 1016 },
        { idx: 11, matches: ["pb_single_y2k_silver_holo"], pass1Id: "pb_single_y2k_silver_holo", cx: 55, cy: 55, cw: 970, ch: 970 }
    ];

    const STICKER_ID_MAP = {
        "stk_dio_pm2": "locket",
        "stk_dio_cash": "cash_money",
        "stk_dio_wedding": "flower_crown",
        "stk_dio_bearded_holiday": "bearded"
    };

    function storeRead(key) {
        try {
            if (typeof $persistentStore !== "undefined") return $persistentStore.read(key) || "";
            if (typeof $prefs !== "undefined") return $prefs.valueForKey(key) || "";
        } catch (e) {}
        return "";
    }

    function storeWrite(key, val) {
        try {
            if (typeof $persistentStore !== "undefined") $persistentStore.write(String(val), key);
            else if (typeof $prefs !== "undefined") $prefs.setValueForKey(String(val), key);
        } catch (e) {}
    }

    function getDeviceIpPrefix() {
        let prefix = storeRead("LOCKET_PB_IP_PREFIX");
        if (!prefix || prefix.split(".").length !== 3) {
            const o2 = Math.floor(Math.random() * 200) + 20;
            const o3 = Math.floor(Math.random() * 200) + 20;
            prefix = "100." + o2 + "." + o3;
            storeWrite("LOCKET_PB_IP_PREFIX", prefix);
        }
        return prefix;
    }

    function saveFilterId(fid) {
        if (!fid) return;
        storeWrite("LOCKET_PB_FILTER_ID", String(fid));
    }

    function readFilterId() {
        try {
            if (typeof $request !== "undefined" && $request.body) {
                const reqObj = JSON.parse($request.body);
                const d = reqObj.data || reqObj;
                if (d && (d.filterId || d.prompt)) {
                    return String(d.filterId || d.prompt);
                }
            }
        } catch (e) {}
        return storeRead("LOCKET_PB_FILTER_ID");
    }

    function findTwoPass(fid) {
        const lower = String(fid || "").toLowerCase();
        for (let i = 0; i < TWO_PASS_CONFIGS.length; i++) {
            const cfg = TWO_PASS_CONFIGS[i];
            for (let j = 0; j < cfg.matches.length; j++) {
                if (lower.indexOf(cfg.matches[j]) !== -1) {
                    return cfg;
                }
            }
        }
        return null;
    }

    function findSingleCrop(fid) {
        const lower = String(fid || "").toLowerCase();
        for (let i = 0; i < SINGLE_CROP_CONFIGS.length; i++) {
            const c = SINGLE_CROP_CONFIGS[i];
            for (let j = 0; j < c.matches.length; j++) {
                const m = c.matches[j];
                if (c.exact ? lower === m : lower.indexOf(m) !== -1) {
                    return c;
                }
            }
        }
        return null;
    }

    function setAllUrls(resObj, newUrl) {
        const fields = ["outputUrl", "output_url", "url", "imageUrl", "image_url"];
        const targets = [resObj, resObj && resObj.result, resObj && resObj.result && resObj.result.data];
        for (let t = 0; t < targets.length; t++) {
            const obj = targets[t];
            if (obj && typeof obj === "object") {
                for (let f = 0; f < fields.length; f++) {
                    if (obj[fields[f]]) obj[fields[f]] = newUrl;
                }
            }
        }
    }

    function toSslIpHttp(urlStr) {
        return String(urlStr || "")
            .split("?")[0]
            .replace(/^https?:\/\/us-central1-locket-4252a\.cloudfunctions\.net/, "http://180-93-61-146.sslip.io")
            .replace(/^https?:\/\/180\.93\.61\.146/, "http://180-93-61-146.sslip.io");
    }

    // 1. HTTP-REQUEST MODE: Rewrite custom 4-shot photobooth filterId to Pass 1 cute grid & isolate session IP
    if (typeof $response === "undefined") {
        try {
            if (!$request || !$request.body) return $done({});
            const reqObj = JSON.parse($request.body);
            const d = reqObj.data || reqObj;
            const fid = String((d && (d.filterId || d.prompt)) || "");
            saveFilterId(fid);

            const headers = Object.assign({}, $request.headers || {});
            const prefix = getDeviceIpPrefix();

            const twoPass = findTwoPass(fid);
            if (twoPass && d) {
                d.filterId = twoPass.pass1Id;
                d.prompt = twoPass.pass1Id;
                const clientIp = prefix + "." + twoPass.idx;
                headers["X-Forwarded-For"] = clientIp;
                headers["CF-Connecting-IP"] = clientIp;
                headers["X-Real-IP"] = clientIp;
                return $done({ headers: headers, body: JSON.stringify(reqObj) });
            }

            const singleCrop = findSingleCrop(fid);
            if (singleCrop && d) {
                if (singleCrop.pass1Id && d.filterId !== singleCrop.pass1Id) {
                    d.filterId = singleCrop.pass1Id;
                    d.prompt = singleCrop.pass1Id;
                }
                const clientIp = prefix + "." + singleCrop.idx;
                headers["X-Forwarded-For"] = clientIp;
                headers["CF-Connecting-IP"] = clientIp;
                headers["X-Real-IP"] = clientIp;
                return $done({ headers: headers, body: JSON.stringify(reqObj) });
            }

            if (d && d.filterId && String(d.filterId).indexOf("stk_dio_") === 0) {
                const rawFid = String(d.filterId);
                const mapped = STICKER_ID_MAP[rawFid] || d.prompt || rawFid.replace(/^stk_dio_/, "");
                d.filterId = mapped;
                d.prompt = mapped;
                return $done({ body: JSON.stringify(reqObj) });
            }

            if (fid.toLowerCase().indexOf("photobooth_4cut") !== -1) {
                const clientIp = prefix + ".12";
                headers["X-Forwarded-For"] = clientIp;
                headers["CF-Connecting-IP"] = clientIp;
                headers["X-Real-IP"] = clientIp;
                return $done({ headers: headers, body: JSON.stringify(reqObj) });
            }

            if (fid.toLowerCase().indexOf("photobooth_cute") !== -1) {
                const clientIp = prefix + ".13";
                headers["X-Forwarded-For"] = clientIp;
                headers["CF-Connecting-IP"] = clientIp;
                headers["X-Real-IP"] = clientIp;
                return $done({ headers: headers, body: JSON.stringify(reqObj) });
            }
        } catch (e) {}
        return $done({});
    }

    // 2. HTTP-RESPONSE MODE: Composite & crop to 100% edge-to-edge
    try {
        if (!$response || !$response.body) return $done({});
        const resObj = JSON.parse($response.body);
        const outUrl =
            (resObj && resObj.result && resObj.result.outputUrl) ||
            (resObj && resObj.outputUrl) ||
            (resObj && resObj.result && resObj.result.data && resObj.result.data.outputUrl) ||
            "";
        if (!outUrl) return $done({});

        const fid = readFilterId();
        const rawHttpUrl = toSslIpHttp(outUrl);
        const prefix = getDeviceIpPrefix();

        const twoPass = findTwoPass(fid);
        if (twoPass && typeof $httpClient !== "undefined") {
            const wsrvGridUrl =
                "https://wsrv.nl/?url=" +
                encodeURIComponent(rawHttpUrl) +
                "&cx=116&cy=116&cw=848&ch=848&output=jpg";

            const pass2Ip = prefix + ".250";
            const postOpts = {
                url: "http://180.93.61.146/generateFilteredImage",
                headers: {
                    "Content-Type": "application/json",
                    "Host": "us-central1-locket-4252a.cloudfunctions.net",
                    "X-Forwarded-For": pass2Ip,
                    "CF-Connecting-IP": pass2Ip,
                    "X-Real-IP": pass2Ip
                },
                body: JSON.stringify({
                    data: {
                        imageUrl: wsrvGridUrl,
                        filterId: twoPass.targetFid,
                        filterType: "ai",
                        prompt: twoPass.targetFid
                    }
                }),
                timeout: 15
            };

            $httpClient.post(postOpts, function (err, resp, data) {
                try {
                    if (!err && data) {
                        const pass2Obj = JSON.parse(data);
                        const pass2Url =
                            (pass2Obj && pass2Obj.result && pass2Obj.result.outputUrl) ||
                            (pass2Obj && pass2Obj.outputUrl) ||
                            "";
                        if (pass2Url) {
                            const rawPass2Http = toSslIpHttp(pass2Url);
                            const finalUrl =
                                "https://wsrv.nl/?url=" +
                                encodeURIComponent(rawPass2Http) +
                                "&cx=" + twoPass.cx +
                                "&cy=" + twoPass.cy +
                                "&cw=" + twoPass.cw +
                                "&ch=" + twoPass.ch +
                                "&output=jpg&t=" + Date.now();
                            setAllUrls(resObj, finalUrl);
                            return $done({ body: JSON.stringify(resObj) });
                        }
                    }
                } catch (e) {}
                return $done({ body: JSON.stringify(resObj) });
            });
            return;
        }

        const singleCrop = findSingleCrop(fid);
        if (singleCrop) {
            const finalUrl =
                "https://wsrv.nl/?url=" +
                encodeURIComponent(rawHttpUrl) +
                "&cx=" + singleCrop.cx +
                "&cy=" + singleCrop.cy +
                "&cw=" + singleCrop.cw +
                "&ch=" + singleCrop.ch +
                "&output=jpg&t=" + Date.now();
            setAllUrls(resObj, finalUrl);
            return $done({ body: JSON.stringify(resObj) });
        }
    } catch (e) {}

    return $done({});
})();

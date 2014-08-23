function BackgroundBlendModePolyfill(options) {
    // set defaults
    this.options = {
        selector: '*',
        usePolyfillIf: function () {
            /*if (navigator.appName == 'Microsoft Internet Explorer') {
            var agent = navigator.userAgent;
            if (agent.match(/MSIE ([0-9]{1,}[\.0-9]{0,})/) != null) {
            var version = parseFloat(RegExp.$1);
            if (version < 11)
            return true;
            }
            }
            return false;
            */
            return true;
        }
    };
    if (options) {
        var obj = this;
        $.each(options, function (k, v) {
            obj.options[k] = v;
        });
    }

    if (this.options.usePolyfillIf())
        this.walk_css_tree();
}

// singleton initializer
BackgroundBlendModePolyfill.initialize = function (options) {
    if (BackgroundBlendModePolyfill.singleton == null)
        BackgroundBlendModePolyfill.singleton = new BackgroundBlendModePolyfill(options);
    return BackgroundBlendModePolyfill.singleton;
};

// handle mouse events w/ support for pointer-events: none
BackgroundBlendModePolyfill.prototype.walk_css_tree = function () {
    $(this.options.selector).each(function (i) {
        var g = window.getComputedStyle(this, null);
        var s = g["background-blend-mode"];
        if (!s) {
            s = this.attributes.backgroundblend;
            if(s)
                s = s.value;
        }
        if (s && s != "normal") {
            var b = g.backgroundImage;

            var getRule = function (s) {
                var retval = "bar{";
                for (var x = 0; x < s.length; x++) {
                    if (g[s[x]])
                        retval += s[x] + ":" + g[s[x]] + ";\n";
                    else
                        retval += s[x] + ":" + g[toCamelCase(s[x])] + ";\n";
                }
                retval += "}";
                return retval;
            }

            var getNumber = function (rule) {
                for (var x = 0; x < rule.value.length; x++) {
                    if (rule.value[x].tokenType == "NUMBER") {
                        return rule.value[x].value;
                    }
                }

                return 0;
            }

            var getURLS = function (rule) {
                var a = [];
                for (var x = 0; x < rule.value.length; x++) {
                    if (rule.value[x].tokenType == "DELIM")
                        continue;
                    if (rule.value[x].tokenType == "WHITESPACE")
                        continue;
                    if (rule.value[x].tokenType == "URL") {
                        a.push(rule.value[x].value);
                    } else if (rule.value[x].type == "FUNCTION") {
                        a.push(rule.value[x]);
                    }
                }

                return a;
            }

            var getFunction = function (rule) {
                var s = "";
                if (Object.getPrototypeOf(rule).type == "FUNCTION") {
                    s += rule.name + "(";
                    for (var x = 0; x < rule.value.length; x++) {
                        if (x)
                            s += ", ";

                        s += getNumber(rule.value[x]);
                    }

                    s += ")";

                }

                return s;
            }

            var getColor = function (rule) {
                if (Object.getPrototypeOf(rule).tokenType == "IDENT")
                    return rule.value;

                var s = rule.name + "(";
                for (var x = 0; x < rule.value.length; x++) {
                    if (x)
                        s += ", ";

                    var colorval;
                    for (var y = 0; y < rule.value[x].value.length; y++)
                        if (rule.value[x].value[y].tokenType != "WHITESPACE")
                            colorval = rule.value[x].value[y].value;
                    s += colorval;
                }
                s += ")";

                return s;
            }

            function CSSExtract(a, x) {
                return a[x % (a.length)];
            }

            function toCamelCase(s) {
                s = s.replace(/([^a-zA-Z0-9_\- ])|^[_0-9]+/g, "").trim().toLowerCase();
                s = s.replace(/([ -]+)([a-zA-Z0-9])/g, function (a, b, c) {
                    return c.toUpperCase();
                });
                s = s.replace(/([0-9]+)([a-zA-Z])/g, function (a, b, c) {
                    return b + c.toUpperCase();
                });
                return s;
            }
            var rule = getRule(["background-image",
                                "background-blend-mode",
                                "background-color",
                                "background-size",
                                "background-repeat",
                                "background-position"]);
            var tokens = tokenize(rule);
            var sheet = parse(tokens).value[0].value;
            var width = $(this).width();
            var height = $(this).height();

            if(rule["background-blend-mode"] === undefined) {
                rule["background-blend-mode"] = s.split(" ,");
            }

            var parseBackgrounds = function () {
                var retval = {};

                retval.images = getURLS(sheet[0]);
                var numImages = retval.images.length;

                var offset = 0;
                var bksize = sheet[3].value;
                retval.sizes = [];
                for (var x = 0; x < numImages; x++, offset++) {
                    var entry = bksize[offset];

                    if (entry) {
                        while (entry.tokenType == "DELIM" || entry.tokenType == "WHITESPACE")
                            entry = bksize[++offset];

                        var xsize = entry.value;
                        var isCover = false;
                        if (entry.tokenType == "DIMENSION") {
                            xsize = entry.num;
                        } else if (entry.tokenType == "PERCENTAGE") {
                            xsize = width * entry.value / 100;
                        } else if ((entry.value == "cover") || (entry.value == "contain")) {
                            xsize = width;
                            isCover = true;
                        }
                        entry = bksize[++offset];

                        if (entry == undefined) {
                            ysize = isCover ? height : xsize;
                        } else {
                            while (entry.tokenType == "DELIM" || entry.tokenType == "WHITESPACE")
                                entry = bksize[++offset];

                            var ysize = entry.value;
                            if (entry.tokenType == "DIMENSION") {
                                ysize = entry.num;
                            } else if (entry.tokenType == "PERCENTAGE") {
                                ysize = height * entry.value / 100;
                            }
                        }
                        var imgwidth;
                        var imgheight;
                    } // this should be fixed for missing background sizes

                    if (xsize == "auto" && ysize == "auto") {
                        if (htmlimages[x]) {
                            imgwidth = htmlimages[x].width;
                            imgheight = htmlimages[x].height;
                        } else {
                            imgwidth = width;
                            imgheight = height;
                        }
                    } else if (xsize == "auto") {
                        imgheight = ysize;
                        if (htmlimages[x])
                            imgwidth = htmlimages[x].width / htmlimages[x].height * imgheight;
                        else
                            imgwidth = width;
                    } else if (ysize == "auto") {
                        imgwidth = xsize;
                        if (htmlimages[x])
                            imgheight = htmlimages[x].height / htmlimages[x].width * imgwidth;
                        else
                            imgheight = height;
                    } else {
                        imgwidth = xsize;
                        imgheight = ysize;
                    }
                    retval.sizes[x] = { width: imgwidth, height: imgheight };
                }

                retval.repeat = [];
                var bkrepeat = sheet[4].value;
                offset = 0;
                for (var x = 0; x < numImages; x++, offset++) {
                    var entry = bkrepeat[offset];

                    while (entry.tokenType == "DELIM" || entry.tokenType == "WHITESPACE")
                        entry = bkrepeat[++offset];

                    retval.repeat[x] = entry.value;
                }

                retval.position = [];
                var bkposition = sheet[5].value;
                offset = 0;
                for (var x = 0; x < numImages; x++, offset++) {
                    var entry = bkposition[offset];
                    var add = true;

                    while (entry.tokenType == "DELIM" || entry.tokenType == "WHITESPACE")
                        entry = bkposition[++offset];

                    var xpos = entry.value;
                    if (entry.tokenType == "IDENT") {
                        if (retval.repeat[x] == "repeat" || retval.repeat[x] == "repeat-x")
                            xpos = 0;
                        else if (entry.value == "left")
                            xpos = 0;
                        else if (entry.value == "right") {
                            xpos = width - retval.sizes[x].width;
                            add = false;
                        } else if (entry.value == "center")
                            xpos = width / 2;

                        entry = bkposition[++offset];

                        while (entry.tokenType == "WHITESPACE")
                            entry = bkposition[++offset];

                        if (entry.tokenType == "DIMENSION") {
                            xpos += add ? entry.num : -entry.num;
                        }

                        add = true;

                    } else if (entry.tokenType == "DIMENSION") {
                        xpos = entry.num;
                    } else if (entry.tokenType == "PERCENTAGE") {
                        xpos = (width - retval.sizes[x].width) * entry.value / 100;
                    }

                    entry = bkposition[++offset];

                    while (entry.tokenType == "DELIM" || entry.tokenType == "WHITESPACE")
                        entry = bkposition[++offset];

                    var ypos = entry.value;
                    if (entry.tokenType == "IDENT") {
                        if (retval.repeat[x] == "repeat" || retval.repeat[x] == "repeat-y")
                            ypos = 0;
                        else if (entry.value == "top")
                            ypos = 0;
                        else if (entry.value == "bottom") {
                            ypos = height - retval.sizes[x].height;
                            add = false;
                        } else if (entry.value == "center")
                            ypos = height / 2;

                        entry = bkposition[++offset];

                        while (entry.tokenType == "WHITESPACE")
                            entry = bkposition[++offset];

                        if (entry.tokenType == "DIMENSION") {
                            ypos += add ? entry.num : -entry.num;
                        }
                    } else if (entry.tokenType == "DIMENSION") {
                        ypos = entry.num;
                    } else if (entry.tokenType == "PERCENTAGE") {
                        ypos = (height - retval.sizes[x].height) * entry.value / 100;
                    }

                    retval.position[x] = { x: xpos, y: ypos };
                }

                retval.blendmodes = [];
                var bkblend = sheet[1].value;
                offset = 0;
                for (var x = 0; x < bkblend.length; x++) {
                    var entry = bkblend[x];

                    if (entry.tokenType == "IDENT")
                        retval.blendmodes.push(entry.value);
                }
                if ((retval.blendmodes.length > 0) && (retval.blendmodes[0] == "undefined"))
                    retval.blendmodes = s.split(" ,");

                return retval;
            }

            var radians = function (degrees) {
                return degrees * Math.PI / 180;
            };

            var degrees = function (radians) {
                return radians / Math.PI * 180;
            };

            var ToPx = function (DimToken) {
                switch (DimToken.unit) {
                    case "px": return DimToken.num;
                    case "em": return DimToken.num * parseFloat(g["font-size"]);
                    case "cm": return DimToken.num / 2.54 * 96;
                    case "mm": return DimToken.num / 2.54 * 96 / 10;
                    case "in": return DimToken.num / 96;
                    case "pt": return DimToken.num / 72 * 96;
                    case "ct": return DimToken.num / 6 * 96;
                }
                return 0;
            }

            ////////////////////////
            var images = getURLS(sheet[0]);
            var htmlimages = [];
            var cnt = 0;

            var createGradient = function (info, width, height) {
                var canv;
                if (info.name == "linear-gradient" || info.name == "radial-gradient") {
                    canv = document.createElement("canvas");
                    canv.width = width;
                    canv.height = height;
                }

                var offset = 0;
                var stops = [];
                var colors = [];
                var abscolors = [];
                var angle = 180;
                var radialSizeX = NaN;
                var radialSizeY = NaN;
                var xgradpos = NaN;
                var ygradpos = NaN;
                var ellipse = true;
                var absolutepos = false;
                if (info.name == "linear-gradient") {
                    for (var x = 0; x < info.value.length; x++) {
                        var stopFunction = info.value[x];
                        var stop;
                        var stoppos = NaN;
                        var SetAngle = false;
                        for (var y = 0; y < stopFunction.value.length; y++) {
                            if (stopFunction.value[y].tokenType != "WHITESPACE") {
                                if (stopFunction.value[y].tokenType == "DIMENSION") {
                                    SetAngle = true;
                                    angle = stopFunction.value[y].num;
                                } else if (stopFunction.value[y].tokenType == "PERCENTAGE")
                                    stoppos = stopFunction.value[y].value / 100;
                                else
                                    stop = stopFunction.value[y];
                            }

                        }
                        if (!SetAngle) {
                            abscolors.push(absolutepos);
                            stops.push(stoppos);
                            colors.push(getColor(stop));
                        }
                    }
                }
                else if (info.name == "radial-gradient") {
                    for (var x = 0; x < info.value.length; x++) {
                        var stopFunction = info.value[x];
                        var stop;
                        var absolutepos = false;
                        var stoppos = NaN;
                        var SetAngle = false;
                        var doingpositioning = false;
                        for (var y = 0; y < stopFunction.value.length; y++) {
                            if (stopFunction.value[y].tokenType != "WHITESPACE") {
                                if (stopFunction.value[y].tokenType == "IDENT" && (
                                        stopFunction.value[y].value == "at" ||
                                        stopFunction.value[y].value == "circle" ||
                                        stopFunction.value[y].value == "ellipse")) {
                                    radialSizeX = Infinity;
                                    radialSizeY = Infinity;
                                    doingpositioning = true;
                                    if (stopFunction.value[y].value == "circle")
                                        ellipse = false;
                                } else if (stopFunction.value[y].tokenType == "DIMENSION") {
                                    if (doingpositioning) {
                                        if (isNaN(radialSizeX)) {
                                            radialSizeX = ToPx(stopFunction.value[y]);
                                            radialSizeY = ToPx(stopFunction.value[y]);
                                            ellipse = false;
                                            doingpositioning = true;
                                        } else if (isNaN(xgradpos))
                                            xgradpos = ToPx(stopFunction.value[y]);
                                        else
                                            ygradpos = ToPx(stopFunction.value[y]);
                                    } else {
                                        stoppos = ToPx(stopFunction.value[y]);
                                        absolutepos = true;
                                    }
                                } else if (stopFunction.value[y].tokenType == "PERCENTAGE") {
                                    if (doingpositioning) {
                                        if (isNaN(xgradpos))
                                            xgradpos = stopFunction.value[y].value / 100 * width;
                                        else
                                            ygradpos = stopFunction.value[y].value / 100 * height;
                                    } else
                                        stoppos = stopFunction.value[y].value / 100;
                                }
                                else {
                                    if (doingpositioning) {
                                        if (isNaN(xgradpos))
                                            xgradpos = stopFunction.value[y].value;
                                        else
                                            ygradpos = stopFunction.value[y].value;
                                    } else
                                        stop = stopFunction.value[y];
                                }
                            }
                        }

                        if (stop) {
                            abscolors.push(absolutepos);
                            stops.push(stoppos);
                            colors.push(getColor(stop));
                        }

                        if (isNaN(xgradpos))
                            xgradpos = width / 2;
                        if (isNaN(ygradpos))
                            ygradpos = height / 2;
                    }

                    if (isNaN(radialSizeX) || !isFinite(radialSizeX)) {
                        var radialSizeX = xgradpos > (width / 2) ? xgradpos : (width - xgradpos);
                        var radialSizeY = ygradpos > (height / 2) ? ygradpos : (height - ygradpos);
                    }
                }

                var grad;
                var gradLength;
                if (info.name == "linear-gradient") {
                    var hyp = Math.sqrt(width * width / 4 + height * height / 4);
                    var baseangle = degrees(Math.asin(width / 2 / hyp));

                    // normalize angle
                    while (angle < 0)
                        angle += 360;
                    angle %= 360;

                    var length;
                    var reducedAngle = angle % 180;
                    if (reducedAngle > 90)
                        reducedAngle = 180 - reducedAngle;
                    if (reducedAngle <= baseangle)
                        length = hyp * Math.cos(radians(baseangle - reducedAngle));
                    else
                        length = hyp * Math.cos(radians(reducedAngle - baseangle));

                    gradLength = 2 * length;

                    var offsetx = Math.sin(radians(angle)) * length;
                    var offsety = Math.cos(radians(angle)) * length;

                    var ctx = canv.getContext("2d"); ;
                    grad = ctx.createLinearGradient(width / 2 - offsetx, height / 2 + offsety, width / 2 + offsetx, height / 2 - offsety);
                } else if (info.name == "radial-gradient") {
                    var ctx = canv.getContext("2d");
                    var ratio = radialSizeX / radialSizeY;
                    if (ellipse)
                        grad = ctx.createRadialGradient(xgradpos / ratio, ygradpos, 0, xgradpos / ratio, ygradpos, Math.sqrt(2) * radialSizeY);
                    else
                        grad = ctx.createRadialGradient(xgradpos, ygradpos, 0, xgradpos, ygradpos, Math.sqrt(radialSizeX * radialSizeX + radialSizeY * radialSizeY));

                    gradLength = Math.sqrt(radialSizeX * radialSizeX + radialSizeY * radialSizeY);
                }

                for (var x = 0; x < stops.length; x++)
                    if (abscolors[x])
                        stops[x] /= gradLength;

                if (isNaN(stops[0]))
                    stops[0] = 0;

                if (isNaN(stops[stops.length - 1]))
                    stops[stops.length - 1] = 1.0;

                var curval = 0;
                for (var x = 0; x < stops.length; x++) {
                    if (stops[x] < curval)
                        stops[x] = curval;

                    if (stops[x] > 1)
                        stops[x] = 1;
                    if (!isNaN(stops[x]))
                        curval = stops[x];
                }

                for (var x = 0; x < stops.length; x++) {
                    if (isNaN(stops[x])) {
                        var prev = stops[x - 1];
                        var next = NaN;
                        var y = x + 1;
                        while (isNaN(stops[y]))
                            y++;

                        stops[x] = prev + (stops[y] - prev) / (y - x + 1);
                        if (stops[x] > 1)
                            stops[x] = 1;
                    }
                }

                for (var x = 0; x < stops.length; x++)
                    grad.addColorStop(stops[x], colors[x]);

                ctx.save();
                if (ellipse)
                    ctx.scale(ratio, 1);
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, width + height, width + height);
                ctx.restore();

                return canv;
            }

            var thiselement = this;

            var DoDraw = function () {
                cnt++;
                if (cnt < images.length)
                    return;

                var info = parseBackgrounds();
                var canvaselement = document.createElement('canvas');
                canvaselement.width = width;
                canvaselement.height = height;
                var ctx = canvaselement.getContext("2d");
                var oldctx;

                ctx.fillStyle = getFunction(sheet[2].value[0]);
                ctx.fillRect(0, 0, width, height);

                for (var x = images.length - 1; x >= 0; x--) {
                    ctx.save();
                    var bmode = CSSExtract(info.blendmodes, x);
                    if (bmode == "normal")
                        bmode = "source-over";
                    if(bmode != "normal")
                        ctx.globalCompositeOperation = bmode;
                    if (bmode != ctx.globalCompositeOperation) { //unsupported
                        oldctx = ctx;
                        var canv = document.createElement("canvas");
                        canv.width = width;
                        canv.height = height;
                        ctx = canv.getContext("2d");
                    }

                    var paint = htmlimages[x];
                    var imgwidth;
                    var imgheight;
                    if (!paint) { // gradient
                        paint = createGradient(images[x], CSSExtract(info.sizes, x).width, CSSExtract(info.sizes, x).height);
                        imgwidth = CSSExtract(info.sizes, x).width;
                        imgheight = CSSExtract(info.sizes, x).height;
                    } else {
                        imgwidth = htmlimages[x].width;
                        imgheight = htmlimages[x].height;
                    }
                    if (CSSExtract(info.repeat, x) == "no-repeat")
                        ctx.drawImage(paint, 0, 0, imgwidth, imgheight, CSSExtract(info.position, x).x, CSSExtract(info.position, x).y, CSSExtract(info.sizes, x).width, CSSExtract(info.sizes, x).height);
                    else {
                        var repeatstring = CSSExtract(info.repeat, x);
                        var pattern = ctx.createPattern(paint, CSSExtract(info.repeat, x));
                        ctx.save();

                        var scaleX = CSSExtract(info.sizes, x).width / imgwidth;
                        var scaleY = CSSExtract(info.sizes, x).height / imgheight;
                        ctx.translate(CSSExtract(info.position, x).x, CSSExtract(info.position, x).y);
                        ctx.scale(scaleX, scaleY);

                        ctx.fillStyle = pattern;

                        var xpos = 0;
                        var ypos = 0;
                        if (repeatstring == "repeat" || repeatstring == "repeat-x") {
                            xpos -= width / scaleX;
                        }
                        if (repeatstring == "repeat" || repeatstring == "repeat-y") {
                            ypos -= height / scaleY;
                        }
                        ctx.fillRect(xpos, ypos, width / scaleX * 2 - CSSExtract(info.position, x).x, height / scaleY * 2 - CSSExtract(info.position, x).y);
                        ctx.restore();
                    }

                    if (bmode != ctx.globalCompositeOperation) {

                        var B = function (a, b) {
                            return b;
                        }
                        var Lum = function (p) {
                            return (77 * p.r + 150 * p.g + 28 * p.b) >> 8;
                        }
                        var ClipColor = function (p) {
                            var L = Lum(p)
                            var n = Math.min(p.r, Math.min(p.g, p.b));
                            var x = Math.max(p.r, Math.max(p.g, p.b));
                            if (n < 0) {
                                p.r = L + (((p.r - L) * L) / (L - n));
                                p.g = L + (((p.g - L) * L) / (L - n));
                                p.b = L + (((p.b - L) * L) / (L - n));
                            }

                            if (x > 255) {
                                p.r = L + (((p.r - L) * (255 - L)) / (x - L));
                                p.g = L + (((p.g - L) * (255 - L)) / (x - L));
                                p.b = L + (((p.b - L) * (255 - L)) / (x - L));
                            }

                            return p;
                        }
                        var SetLum = function (p, l) {
                            var d = l - Lum(p);
                            var q = {};
                            q.r = p.r + d;
                            q.g = p.g + d;
                            q.b = p.b + d;
                            return ClipColor(q);
                        }
                        var Sat = function (p) {
                            return Math.max(p.r, Math.max(p.g, p.b)) - Math.min(p.r, Math.min(p.g, p.b));
                        }
                        var setSaturationComponents = function (Cmin, Cmid, Cmax, s) {
                            var p = {};
                            if (Cmax > Cmin) {
                                p.Cmid = (Cmid - Cmin) * s / (Cmax - Cmin);
                                p.Cmax = s;
                            } else {
                                p.Cmax = 0;
                                p.Cmid = 0;
                            }

                            p.Cmin = 0;

                            return p;
                        }

                        var SetSat = function (p, s) {
                            if (p.r <= p.g) {
                                if (p.g <= p.b) {
                                    var q = setSaturationComponents(p.r, p.g, p.b, s);
                                    return { r: q.Cmin, g: q.Cmid, b: q.Cmax };
                                } else if (p.r <= p.b) {
                                    var q = setSaturationComponents(p.r, p.b, p.g, s);
                                    return { r: q.Cmin, b: q.Cmid, g: q.Cmax };
                                } else {
                                    var q = setSaturationComponents(p.b, p.r, p.g, s);
                                    return { b: q.Cmin, r: q.Cmid, g: q.Cmax };
                                }
                            } else if (p.r <= p.b) {
                                var q = setSaturationComponents(p.g, p.r, p.b, s);
                                return { g: q.Cmin, r: q.Cmid, b: q.Cmax };
                            } else if (p.g <= p.b) {
                                var q = setSaturationComponents(p.g, p.b, p.r, s);
                                return { g: q.Cmin, b: q.Cmid, r: q.Cmax };
                            } else {
                                var q = setSaturationComponents(p.b, p.g, p.r, s);
                                return { b: q.Cmin, g: q.Cmid, r: q.Cmax };
                            }
                        }

                        var multiply = function (Cb, Cs) {
                            return (Cb * Cs) >> 8;
                        }
                        var screenf = function (Cb, Cs) {
                            return (255 * (Cb + Cs) - (Cb * Cs)) >> 8;
                        }

                        var softlight = function (Cb, Cs) {
                            Cb /= 255;
                            Cs /= 255;
                            if (Cs <= .5)
                                return (Cb - (1 - 2 * Cs) * Cb * (1 - Cb)) * 255;

                            if (Cb <= .25)
                                var D = ((16 * Cb - 12) * Cb + 4) * Cb;
                            else
                                var D = Math.sqrt(Cb);

                            return (Cb + (2 * Cs - 1) * (D - Cb)) * 255;
                        }
                        var nonsep = false;
                        switch (bmode) {
                            case 'multiply': B = multiply; break;
                            case 'screen': B = screenf; break;
                            case 'overlay': B = function (a, b) { if(a <= 127) return multiply(b, 2 * a); else return screenf(b, 2 * a - 255);}; break;
                            case 'darken': B = function (a, b) { return a < b ? a : b; }; break;
                            case 'lighten': B = function (a, b) { return a < b ? a : b; }; break;
                            case 'color-dodge': B = function (a, b) { if (a == 0) return 0; if (b == 255) return 255; return Math.min(255, a / (255 - b) * 255); }; break;
                            case 'color-burn': B = function (a, b) { if (a == 255) return 255; if (b == 0) return 0; return 255 - Math.min(255, (255 - a) / b * 255); }; break;
                            case 'hard-light': B = function (a, b) { if(b <= 127) return multiply(a, 2 * b); else return screenf(a, 2 * b - 255); }; break;
                            case 'soft-light': B = softlight; break;
                            case 'difference': B = function (a, b) { return Math.abs(a - b); }; break;
                            case 'exclusion': B = function (a, b) { return Math.abs(a - b); }; break;
                            case 'hue': B = function (Cs, Cb) { return SetLum(SetSat(Cs, Sat(Cb)), Lum(Cb)); }; nonsep = true; break;
                            case 'saturation': B = function (Cs, Cb) { return SetLum(SetSat(Cb, Sat(Cs)), Lum(Cb)); }; nonsep = true; break;
                            case 'color': B = function (Cs, Cb) { return SetLum(Cs, Lum(Cb)); }; nonsep = true; break;
                            case 'luminosity': B = function (Cs, Cb) { return SetLum(Cb, Lum(Cs)); }; nonsep = true; break;
                        }

                        var imgsource = ctx.getImageData(0, 0, width, height);
                        var source = imgsource.data;
                        var imgdest = oldctx.getImageData(0, 0, width, height);
                        var dest = imgdest.data;

                        if (nonsep)
                            for (var y = 0; y < width * height; y++) {
                                if (source[y * 4 + 3] == 0)
                                    continue;
                                var Cs = { r: source[y * 4 + 0], g: source[y * 4 + 1], b: source[y * 4 + 2] };
                                var Cb = { r: dest[y * 4 + 0], g: dest[y * 4 + 1], b: dest[y * 4 + 2] };

                                var Cn = B(Cs, Cb);

                                var alpha = dest[y * 4 + 3];

                                source[y * 4 + 0] = ((255 - alpha) * Cs.r + alpha * Math.floor(Cn.r)) >> 8;
                                source[y * 4 + 1] = ((255 - alpha) * Cs.g + alpha * Math.floor(Cn.g)) >> 8;
                                source[y * 4 + 2] = ((255 - alpha) * Cs.b + alpha * Math.floor(Cn.b)) >> 8;
                            } else
                            for (var y = 0; y < width * height; y++) {
                                if (source[y * 4 + 3] == 0)
                                    continue;
                                source[y * 4 + 0] = ((255 - dest[y * 4 + 3]) * source[y * 4 + 0] + dest[y * 4 + 3] * B(dest[y * 4 + 0], source[y * 4 + 0])) >> 8;
                                source[y * 4 + 1] = ((255 - dest[y * 4 + 3]) * source[y * 4 + 1] + dest[y * 4 + 3] * B(dest[y * 4 + 1], source[y * 4 + 1])) >> 8;
                                source[y * 4 + 2] = ((255 - dest[y * 4 + 3]) * source[y * 4 + 2] + dest[y * 4 + 3] * B(dest[y * 4 + 2], source[y * 4 + 2])) >> 8;
                            }
                        ctx.putImageData(imgsource, 0, 0);
                        oldctx.drawImage(ctx.canvas, 0, 0);

                        ctx = oldctx;
                    }
                    ctx.restore();
                }
                var imagepixels = canvaselement.toDataURL('image/jpeg');
                thiselement.style.backgroundImage = 'url(' + imagepixels + ')';
                thiselement.style.backgroundPosition = "0 0";
                thiselement.style.backgroundSize = "100% 100%";
                thiselement.style.backgroundColor = "transparent";
                thiselement.style.backgroundBlendMode = "normal";

            }

            var CallDoDraw = true;
            for (var x = 0; x < images.length; x++) {
                if (typeof images[x] === "string") {
                    CallDoDraw = false;
                    var img = new Image();
                    htmlimages.push(img);
                    img.onload = DoDraw;
                    img.src = images[x];
                }
                else
                    htmlimages.push(undefined);
            }
            if (CallDoDraw) {
                cnt = images.length;
                DoDraw();
            }
        }
    });
};
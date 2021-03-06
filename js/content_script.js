var standardize_quotes = function (text, leftsnglquot, rightsnglquot, leftdblquot, rightdblquot) {
    return text.replace(/[\u2018\u201B]/g, leftsnglquot)
               .replace(/[\u0027\u2019\u201A']/g, rightsnglquot)
               .replace(/[\u201C\u201F]/g, leftdblquot)
               .replace(/[\u0022\u201D"]/g, rightdblquot);
};

var inject_comparison_iframe = function (url, loading_url) {
    var overlay = $("#churnalism-overlay");
    if (overlay.length == 0) {
        var mask = $('<div id="churnalism-mask">\r\n</div>');
        var overlay_frame = $('<iframe id="churnalism-iframe"></iframe>');
        overlay = $('<div id="churnalism-overlay"><button id="churnalism-close">Close</button></div>');

        mask.appendTo("body");
        overlay_frame.appendTo(overlay);
        overlay.appendTo("body");

        overlay_frame.attr('src', loading_url);

        var close_overlay = function (click) {
            $("#churnalism-mask").fadeOut(function(){ $("#churnalism-mask").remove(); });
            $("#churnalism-overlay").fadeOut(function(){ $("#churnalism-overlay").remove(); });
        };

        $("#churnalism-close").click(close_overlay);
        $("#churnalism-mask").click(close_overlay);

        $("#churnalism-mask").scroll(prevent_scroll);
        $("#churnalism-mask").bind('mousewheel', prevent_scroll);
        $("#churnalism-overlay").scroll(prevent_scroll);
        $("#churnalism-overlay").bind('mousewheel', prevent_scroll);

        var resize_frame = function () {
            var docwidth = jQuery(document).width();
            var halfdelta = (docwidth - 1000) / 2;
            $("#churnalism-overlay").css('width', '1000px');
            $("#churnalism-overlay").css('left', halfdelta + 'px');
        };
        resize_frame();
        $(window).resize(resize_frame);

        overlay.fadeIn();
        mask.fadeIn();

        setTimeout(function(){
            overlay_frame.attr('src', url);
        }, 250);
    } else {
        $("#churnalism-iframe").remove();
        var overlay_frame = $('<iframe id="churnalism-iframe"></iframe>');
        overlay_frame.appendTo(overlay);
        overlay_frame.attr('src', url);
    }
};

var inject_warning_ribbon = function (ribbon_url, match_url, loading_url) {
    $("#churnalism-ribbon").remove();

    var ribbon_frame = $('<iframe id="churnalism-ribbon" name="churnalism-ribbon"></iframe>');
    ribbon_frame.prependTo('body');
    ribbon_frame.attr('src', ribbon_url);

    window.addEventListener('message', function(event){
        if (event.data == 'dismiss_churnalism_ribbon') {
            $("#churnalism-ribbon").slideUp('fast', function(){ $(this).remove(); });
        } else if (event.data == 'show_churnalism_comparison') {
            inject_comparison_iframe(match_url, loading_url);
            $("#churnalism-ribbon").slideUp('fast', function(){ $(this).remove(); });
        } else if (event.data == 'show_churnalism_options') {
            chrome.extension.sendRequest({'method': 'showOptionsPage'});
        }
    }, false);

    ribbon_frame.slideDown(400);
};

var fix_iframe_opacity = function () {
    jQuery('iframe').each(function(idx, iframe){
        var src = jQuery(iframe).attr('src');
        // We assume most object/embed tags are flash.
        var contains_flash = $('object, embed', iframe.contentDocument).length > 0;
        if (contains_flash) {
            if (/wmode=opaque/i.test(src)) {
                src = src.replace(/wmode=opaque/i, 'wmode=transparent');
                console.log('Replacing wmode=opaque for ' + src);
                jQuery(iframe).attr('src', src);
            } else if (src != null) {
                src = src + ((src.indexOf('?') == -1) ? '?' : '&') + 'wmode=transparent';
                console.log('appending wmode=transparent for ' + src);
                jQuery(iframe).attr('src', src);
            }
        }
    });
};

var handleMessage = function (request, sender, response) {
    if (request.method == 'log') {
        console.log(request.message);

    } else if (request.method == 'injectIFrame') {
        inject_comparison_iframe(request.url, request.loading_url);

    } else if (request.method == 'injectWarningRibbon') {
        inject_warning_ribbon(request.src, request.match.url, request.loading_url);

    } else if (request.method == 'extractArticle') {
        extract_article();

    } else {
        console.log('content_script.js', 'handleMessage', request, sender, response);
    }
};
chrome.extension.onRequest.addListener(handleMessage);

var prevent_scroll = function (event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};

var extract_article = function () {
    var article = '';
    var title = '';
    try {
        ArticleExtractor(window, LogWrapper.NOTICE);
        var article_document = new ExtractedDocument(document);
        article = article_document.get_article_text();
        article = standardize_quotes(article, "'", "'", '"', '"');
        title = article_document.get_title();
    } catch (e) {
        console.log(e);
        article = '';
        title = '';
    }
    var req = {
        'method': 'articleExtracted',
        'url': window.location.href,
        'text': article,
        'title': title
    };
    chrome.extension.sendRequest(req);
};

jQuery(document).ready(function(){
    console.log("Churnalism loaded.");
    fix_iframe_opacity();
    chrome.extension.sendRequest({'method': 'ready'});
});



define(['jquery', 'storage'], function($, Storage) {

    var App = Class.extend({
        init: function() {
            this.currentPage = 1;
            this.blinkInterval = null;
            this.isParchmentReady = true;
            this.ready = false;
            this.storage = new Storage();
            this.watchNameInputInterval = setInterval(this.toggleButton.bind(this), 100);
            this.initFormFields();

            if(localStorage && localStorage.data) {
                this.frontPage = 'loadcharacter';
            } else {
                this.frontPage = 'createcharacter';
            }
        },

        setGame: function(game) {
            this.game = game;
            this.isMobile = this.game.renderer.mobile;
            this.isTablet = this.game.renderer.tablet;
            this.isDesktop = !(this.isMobile || this.isTablet);
            this.supportsWorkers = !!window.Worker;
            this.ready = true;
        },

        initFormFields: function() {
            var self = this;

            // Play button
            this.$play = $('.play');
            this.getPlayButton = function() { return this.getActiveForm().find('.play span') };
            this.setPlayButtonState(true);

            // Create new character form fields
            this.$nameinput = $('#nameinput');
        },

        center: function() {
            window.scrollTo(0, 1);
        },

        canStartGame: function() {
            if(this.isDesktop) {
                return (this.game && this.game.map && this.game.map.isLoaded);
            } else {
                return this.game;
            }
        },

        tryStartingGame: function() {
            if(this.starting) return;        // Already loading

            var self = this;
            var action = this.createNewCharacterFormActive() ? 'create' : 'login';
            var username = undefined;

            if(action === 'create') {
                username = this.$nameinput.attr('value');
                if(!this.validateFormFields(username)) return;
            }
            
            this.setPlayButtonState(false);

            if(!this.ready || !this.canStartGame()) {
                var watchCanStart = setInterval(function() {
                    log.debug("waiting...");
                    if(self.canStartGame()) {
                        clearInterval(watchCanStart);
                        self.startGame(action, username);
                    }
                }, 100);
            } else {
                this.startGame(action, username);
            }
        },

        startGame: function(action, username) {

            // set to true for production, false for local development
            const enable_secure_transport = false;

            var self = this;
            self.firstTimePlaying = !self.storage.hasAlreadyPlayed();

            if(!this.game.started) {
                var optionsSet = false,
                    config = this.config;

                //>>includeStart("devHost", pragmas.devHost);
                // local and dev configuration does not feature TLS
                if(config.local) {
                    log.debug("Starting game with local dev config.");
                    this.game.setServerOptions(config.local.host, config.local.port, false, username);
                } else {
                    log.debug("Starting game with default dev config.");
                    this.game.setServerOptions(config.dev.host, config.dev.port, false, username);
                }
                // optionsSet = true;  // enable build config
                //>>includeEnd("devHost");

                //>>includeStart("prodHost", pragmas.prodHost);
                if(!optionsSet) {
                    log.debug("Starting game with build config.");

                    // update TLS settings from config
                    // commented out because doesnt work. config is read from somewhere unpredictable... decided to hardcode instead
                    /*
                    let enable_secure_transport = false;
                    if (config.build.secure_transport != undefined) {
                        enable_secure_transport = config.build.secure_transport;
                    }
                    */ 

                    this.game.setServerOptions(config.build.host, enable_secure_transport ? 443 : config.build.port, enable_secure_transport, username);

                }
                //>>includeEnd("prodHost");

                if(!self.isDesktop) {
                    // On mobile and tablet we load the map after the player has clicked
                    // on the login/create button instead of loading it in a web worker.
                    // See initGame in main.js.
                    self.game.loadMap();
                }

                this.center();
                this.game.run(action, function(result) {
                    if(result.success === true) {
                        self.start();
                    } else {
                        self.setPlayButtonState(true);

                        switch(result.reason) {
                            case 'invalidlogin':
                                // No user with matching wallet address found
                                self.addValidationError(null, 'There is no account associated with your metamask account');
                                break;
                            case 'userexists':
                                // Attempted to create a new user, but the username was taken
                                self.addValidationError(self.$nameinput, 'The username you entered is not available.');
                                break;
                            case 'cryptoexists':
                                // Attempted to create a new user, but the crypto wallet address was already registered
                                self.addValidationError(self.$nameinput, 'Your wallet is already associated with another player.');
                                break;
                            case 'invalidusername':
                                // The username contains characters that are not allowed (rejected by the sanitizer)
                                self.addValidationError(self.$nameinput, 'The username you entered contains invalid characters.');
                                break;
                            case 'invalidcryptoaddress':
                                // The crypto wallet address was not initialized
                                self.addValidationError(self.$nameinput, 'Your crypto wallet address could not be loaded or does not match the one stored in the database.');
                                break;
                            case 'loggedin':
                                // Attempted to log in with the same user multiple times simultaneously
                                self.addValidationError(self.$nameinput, 'A player with the specified username is already logged in.');
                                break;
                            case 'metamask':
                                // Metamask could not be initialized properly
                                self.clearValidationErrors();
                                self.addValidationError(null, 'Unable to initialize Metamask. Please try reloading the page and/or opening the Metamask client.');
                                break;
                            default:
                                self.addValidationError(null, 'Failed to launch the game: ' + (result.reason ? result.reason : '(reason unknown)'));
                                break;
                        }
                    }
                });
            }
        },

        start: function() {
            this.hideIntro();
            $('body').addClass('started');
            if(self.firstTimePlaying) {
                this.toggleInstructions();
            }
        },
        
        setPlayButtonState: function(enabled) {
            var self = this;
            var $playButton = this.getPlayButton();

            if(enabled) {
                this.starting = false;
                this.$play.removeClass('loading');
                $playButton.click(function () { self.tryStartingGame(); });
                if(this.playButtonRestoreText) {
                    $playButton.text(this.playButtonRestoreText);
                }
            } else {
                // Loading state
                this.starting = true;
                this.$play.addClass('loading');
                $playButton.unbind('click');
                this.playButtonRestoreText = $playButton.text();
                $playButton.text('Loading...');
            }
        },

        getActiveForm: function() { 
            if(this.loginFormActive()) return $('#loadcharacter');
            else if(this.createNewCharacterFormActive()) return $('#createcharacter');
            else return null;
        },

        loginFormActive: function() {
            return $('#parchment').hasClass("loadcharacter");
        },

        createNewCharacterFormActive: function() {
            return $('#parchment').hasClass("createcharacter");
        },

        validateFormFields: function(username) {
            this.clearValidationErrors();

            if(!username) {
                this.addValidationError(self.$nameinput, 'Please enter a username.');
                return false;
            }

            return true;
        },

        addValidationError: function(field, errorText) {
            $('<span/>', {
                'class': 'validation-error blink',
                text: errorText
            }).appendTo('.validation-summary');

            if(field) {
                field.addClass('field-error').select();
                field.bind('keypress', function (event) {
                    field.removeClass('field-error');
                    $('.validation-error').remove();
                    $(this).unbind(event);
                });
            }
        },

        clearValidationErrors: function() {
            if(!this.loginFormActive()) {
                this.$nameinput.removeClass('field-error');
            }
            $('.validation-error').remove();
        },

        setMouseCoordinates: function(event) {
            var gamePos = $('#container').offset(),
                scale = this.game.renderer.getScaleFactor(),
                width = this.game.renderer.getWidth(),
                height = this.game.renderer.getHeight(),
                mouse = this.game.mouse;

            mouse.x = event.pageX - gamePos.left - (this.isMobile ? 0 : 5 * scale);
            mouse.y = event.pageY - gamePos.top - (this.isMobile ? 0 : 7 * scale);

            if(mouse.x <= 0) {
                mouse.x = 0;
            } else if(mouse.x >= width) {
                mouse.x = width - 1;
            }

            if(mouse.y <= 0) {
                mouse.y = 0;
            } else if(mouse.y >= height) {
                mouse.y = height - 1;
            }
        },
        //Init the hud that makes it show what creature you are mousing over and attacking
        initTargetHud: function(){
            var self = this;
            var scale = self.game.renderer.getScaleFactor(),
                healthMaxWidth = $("#inspector .health").width() - (12 * scale),
                timeout;

            this.game.player.onSetTarget(function(target, name, mouseover){
                var el = '#inspector';
                var sprite = target.sprite,
                    x = ((sprite.animationData.idle_down.length-1)*sprite.width),
                    y = ((sprite.animationData.idle_down.row)*sprite.height);
                $(el+' .name').text(name);

                //Show how much Health creature has left. Currently does not work. The reason health doesn't currently go down has to do with the lines below down to initExpBar...
                if(target.healthPoints){
                    $(el+" .health").css('width', Math.round(target.healthPoints/target.maxHp*100)+'%');
                } else{
                    $(el+" .health").css('width', '0%');
                }
                var level = Types.getMobLevel(Types.getKindFromString(name));
                if(level !== undefined) {
                    $(el + ' .level').text("Level " + level);
                }
                else {
                    $('#inspector .level').text('');
                }

                $(el).fadeIn('fast');
            });

            self.game.onUpdateTarget(function(target){
                $("#inspector .health").css('width', Math.round(target.healthPoints/target.maxHp*100) + "%");
            });

            self.game.player.onRemoveTarget(function(targetId){
                $('#inspector').fadeOut('fast');
                $('#inspector .level').text('');
                self.game.player.inspecting = null;
            });
        },
         initExpBar: function(){
            var maxHeight = $("#expbar").height();

            this.game.onPlayerExpChange(function(expInThisLevel, expForLevelUp){
               var barHeight = Math.round((maxHeight / expForLevelUp) * (expInThisLevel > 0 ? expInThisLevel : 0));
               $("#expbar").css('height', barHeight + "px");
            });
        },

        initHealthBar: function() {
            var scale = this.game.renderer.getScaleFactor(),
                healthMaxWidth = $("#healthbar").width() - (12 * scale);

            this.game.onPlayerHealthChange(function(hp, maxHp) {
                var barWidth = Math.round((healthMaxWidth / maxHp) * (hp > 0 ? hp : 0));
                $("#hitpoints").css('width', barWidth + "px");
            });

            this.game.onPlayerHurt(this.blinkHealthBar.bind(this));
        },

        blinkHealthBar: function() {
            var $hitpoints = $('#hitpoints');

            $hitpoints.addClass('white');
            setTimeout(function() {
                $hitpoints.removeClass('white');
            }, 500)
        },

        toggleButton: function() {
            var name = $('#parchment input').val(),
                $play = $('#createcharacter .play');

            if(name && name.length > 0) {
                $play.removeClass('disabled');
                $('#character').removeClass('disabled');
            } else {
                $play.addClass('disabled');
                $('#character').addClass('disabled');
            }
        },

        hideIntro: function() {
            clearInterval(this.watchNameInputInterval);
            $('body').removeClass('intro');
            setTimeout(function() {
                $('body').addClass('game');
            }, 500);
        },

        showChat: function() {
            if(this.game.started) {
                $('#chatbox').addClass('active');
                $('#chatinput').focus();
                $('#chatbutton').addClass('active');
            }
        },

        hideChat: function() {
            if(this.game.started) {
                $('#chatbox').removeClass('active');
                $('#chatinput').blur();
                $('#chatbutton').removeClass('active');
            }
        },

        toggleInstructions: function() {
            if($('#achievements').hasClass('active')) {
                this.toggleAchievements();
                $('#achievementsbutton').removeClass('active');
            }
            $('#instructions').toggleClass('active');
        },

        toggleAchievements: function() {
            if($('#instructions').hasClass('active')) {
                this.toggleInstructions();
                $('#helpbutton').removeClass('active');
            }
            this.resetPage();
            $('#achievements').toggleClass('active');
        },

        resetPage: function() {
            var self = this,
                $achievements = $('#achievements');

            if($achievements.hasClass('active')) {
                $achievements.bind(TRANSITIONEND, function() {
                    $achievements.removeClass('page' + self.currentPage).addClass('page1');
                    self.currentPage = 1;
                    $achievements.unbind(TRANSITIONEND);
                });
            }
        },

        initEquipmentIcons: function() {
            var scale = this.game.renderer.getScaleFactor(),
                getIconPath = function(spriteName) {
                    return 'img/'+ scale +'/item-' + spriteName + '.png';
                },
                weapon = this.game.player.getWeaponName(),
                armor = this.game.player.getSpriteName(),
                weaponPath = getIconPath(weapon),
                armorPath = getIconPath(armor);
            // Use NFT Sprite if player's got an NFT
            if(this.game.player.nftKey) {
                // Try to get item-sprite for NFT
                let nftSprite = this.game.sprites["item-" + this.game.player.nftKey];
                if(nftSprite)
                {
                    // Try to get filepath property from sprite
                    let nftWeaponPath = nftSprite.filepath;
                    if(nftWeaponPath)
                    {
                        // Use nft icon path if available
                        weaponPath = nftWeaponPath;
                    }
                }
            }
            $('#weapon').css('background-image', 'url("' + weaponPath + '")');
            if(armor !== 'firefox') {
                $('#armor').css('background-image', 'url("' + armorPath + '")');
            }
        },

        hideWindows: function() {
            if($('#achievements').hasClass('active')) {
                this.toggleAchievements();
                $('#achievementsbutton').removeClass('active');
            }
            if($('#instructions').hasClass('active')) {
                this.toggleInstructions();
                $('#helpbutton').removeClass('active');
            }
            if($('body').hasClass('credits')) {
                this.closeInGameScroll('credits');
            }
            if($('body').hasClass('legal')) {
                this.closeInGameScroll('legal');
            }
            if($('body').hasClass('about')) {
                this.closeInGameScroll('about');
            }
        },

        showAchievementNotification: function(id, name) {
            var $notif = $('#achievement-notification'),
                $name = $notif.find('.name'),
                $button = $('#achievementsbutton');

            $notif.removeClass().addClass('active achievement' + id);
            $name.text(name);
            if(this.game.storage.getAchievementCount() === 1) {
                this.blinkInterval = setInterval(function() {
                    $button.toggleClass('blink');
                }, 500);
            }
            setTimeout(function() {
                $notif.removeClass('active');
                $button.removeClass('blink');
            }, 5000);
        },

        displayUnlockedAchievement: function(id) {
            var $achievement = $('#achievements li.achievement' + id),
                achievement = this.game.getAchievementById(id);

            if(achievement && achievement.hidden) {
                this.setAchievementData($achievement, achievement.name, achievement.desc);
            }
            $achievement.addClass('unlocked');
        },

        unlockAchievement: function(id, name) {
            this.showAchievementNotification(id, name);
            this.displayUnlockedAchievement(id);

            var nb = parseInt($('#unlocked-achievements').text());
            $('#unlocked-achievements').text(nb + 1);
        },

        initAchievementList: function(achievements) {
            var self = this,
                $lists = $('#lists'),
                $page = $('#page-tmpl'),
                $achievement = $('#achievement-tmpl'),
                page = 0,
                count = 0,
                $p = null;

            _.each(achievements, function(achievement) {
                count++;

                var $a = $achievement.clone();
                $a.removeAttr('id');
                $a.addClass('achievement'+count);
                if(!achievement.hidden) {
                    self.setAchievementData($a, achievement.name, achievement.desc);
                }
                $a.find('.twitter').attr('href', 'http://twitter.com/share?url=http%3A%2F%2Fbrowserquest.mozilla.org&text=I%20unlocked%20the%20%27'+ achievement.name +'%27%20achievement%20on%20Mozilla%27s%20%23BrowserQuest%21&related=glecollinet:Creators%20of%20BrowserQuest%2Cwhatthefranck');
                $a.show();
                $a.find('a').click(function() {
                    var url = $(this).attr('href');

                    self.openPopup('twitter', url);
                    return false;
                });

                if((count - 1) % 4 === 0) {
                    page++;
                    $p = $page.clone();
                    $p.attr('id', 'page'+page);
                    $p.show();
                    $lists.append($p);
                }
                $p.append($a);
            });

            $('#total-achievements').text($('#achievements').find('li').length);
        },

        initUnlockedAchievements: function(ids) {
            var self = this;

            _.each(ids, function(id) {
                self.displayUnlockedAchievement(id);
            });
            $('#unlocked-achievements').text(ids.length);
        },

        setAchievementData: function($el, name, desc) {
            $el.find('.achievement-name').html(name);
            $el.find('.achievement-description').html(desc);
        },

        toggleScrollContent: function(content) {
            var currentState = $('#parchment').attr('class');

            if(this.game.started) {
                $('#parchment').removeClass().addClass(content);

                $('body').removeClass('credits legal about').toggleClass(content);

                if(!this.game.player) {
                    $('body').toggleClass('death');
                }

                if(content !== 'about') {
                    $('#helpbutton').removeClass('active');
                }
            } else {
                if(currentState !== 'animate') {
                    if(currentState === content) {
                        this.animateParchment(currentState, this.frontPage);
                    } else {
                        this.animateParchment(currentState, content);
                    }
                }
            }
        },

        closeInGameScroll: function(content) {
            $('body').removeClass(content);
            $('#parchment').removeClass(content);
            if(!this.game.player) {
                $('body').addClass('death');
            }
            if(content === 'about') {
                $('#helpbutton').removeClass('active');
            }
        },

        togglePopulationInfo: function() {
            $('#population').toggleClass('visible');
        },

        openPopup: function(type, url) {
            var h = $(window).height(),
                w = $(window).width(),
                popupHeight,
                popupWidth,
                top,
                left;

            switch(type) {
                case 'twitter':
                    popupHeight = 450;
                    popupWidth = 550;
                    break;
                case 'facebook':
                    popupHeight = 400;
                    popupWidth = 580;
                    break;
            }

            top = (h / 2) - (popupHeight / 2);
            left = (w / 2) - (popupWidth / 2);

            newwindow = window.open(url,'name','height=' + popupHeight + ',width=' + popupWidth + ',top=' + top + ',left=' + left);
            if (window.focus) {newwindow.focus()}
        },

        animateParchment: function(origin, destination) {
            var self = this,
                $parchment = $('#parchment'),
                duration = 1;

            if(this.isMobile) {
                $parchment.removeClass(origin).addClass(destination);
            } else {
                if(this.isParchmentReady) {
                    if(this.isTablet) {
                        duration = 0;
                    }
                    this.isParchmentReady = !this.isParchmentReady;

                    $parchment.toggleClass('animate');
                    $parchment.removeClass(origin);

                    setTimeout(function() {
                        $('#parchment').toggleClass('animate');
                        $parchment.addClass(destination);
                    }, duration * 1000);

                    setTimeout(function() {
                        self.isParchmentReady = !self.isParchmentReady;
                    }, duration * 1000);
                }
            }
        },

        animateMessages: function() {
            var $messages = $('#notifications div');

            $messages.addClass('top');
        },

        resetMessagesPosition: function() {
            var message = $('#message2').text();

            $('#notifications div').removeClass('top');
            $('#message2').text('');
            $('#message1').text(message);
        },

        showMessage: function(message) {
            var $wrapper = $('#notifications div'),
                $message = $('#notifications #message2');

            this.animateMessages();
            $message.text(message);
            if(this.messageTimer) {
                this.resetMessageTimer();
            }

            this.messageTimer = setTimeout(function() {
                    $wrapper.addClass('top');
            }, 5000);
        },

        resetMessageTimer: function() {
            clearTimeout(this.messageTimer);
        },

        resizeUi: function() {
            if(this.game) {
                if(this.game.started) {
                    this.game.resize();
                    this.initHealthBar();
                    this.initTargetHud();
                    this.initExpBar();
                    this.game.updateBars();
                } else {
                    var newScale = this.game.renderer.getScaleFactor();
                    this.game.renderer.rescale(newScale);
                }
            }
        }
    });

    return App;
});

(function () {

    var app = angular.module('Plunner');
    /**
     Http interceptors
     **/
    app.config(['$httpProvider','configServiceProvider',
        function ($httpProvider, configServiceProvider) {
            var apiDomain = configServiceProvider.$get().apiDomain;
            var excludedUrlFromToken = [
                apiDomain + '/companies/auth/login',
                apiDomain + '/companies/auth/register',
                apiDomain + '/companies/password/email',
                apiDomain + '/employees/auth/login',
                apiDomain + '/companies/password/email',
                apiDomain + '/companies/password/reset',
                apiDomain + '/employees/password/email',
                apiDomain + '/employees/password/reset'
            ];

            $httpProvider.interceptors.push(function ($q, $cookies, $location) {
                return {
                    request: function (config) {
                        //If not template retrieving requests
                        if (config.url.search('app/') === -1) {
                            //Post requests always pack data as classic post form parameters
                            if (config.method === 'POST' || config.method === 'PUT') {
                                config.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
                            }
                            //all requests need to specify a jwt except for the ones in the excludedUrlFromToken array
                            if (excludedUrlFromToken.indexOf(config.url) === -1) {
                                var token = window.localStorage['auth_token'];
                                /*console.log("Url "+config.url);
                                 console.log('Appending token to request '+token);*/
                                if (token) {
                                    config.headers.Authorization = token;
                                }
                            }

                        }
                        return config;
                    },
                    response: function (response) {
                        //If not template retrieving requests or OPTIONS requests
                        if (response.config.url.search('app/') === -1 && response.config.method !== 'OPTIONS' && response.config.url.search('email') === -1) {
                            //Gets the refreshed jwt
                            var token, exp;
                            if (response.config.url === apiDomain + '/companies/auth/login' || response.config.url === apiDomain + '/employees/auth/login') {
                                token = 'Bearer ' + response.data.token;
                            }
                            else {
                                token = response.headers('Authorization');
                            }
                            if (window.localStorage['auth_token']) {
                                window.localStorage.removeItem('auth_token');
                            }
                            window.localStorage.setItem('auth_token', token);
                        }
                        return response;
                    },
                    responseError: function (response) {
                        if (response.status === 401) {
                            window.localStorage.removeItem('auth_token');
                            $location.path('/401');
                        }
                        else if (response.status === 403) {
                            $location.path('/403');
                        }
                        else if (response.status === 404) {
                            //General com error broadcast
                            $location.path('/404')
                        }
                        else if (response.status === 500){
                            $location.path('/500')
                        }
                        else if (response.status !== 422) {
                            $location.path('/error')
                        }
                        return $q.reject(response);
                    }
                };
            });
        }]);
}());

package com.hayaletev.gaiaclient.service

import android.os.Binder

class ClientBinder(val service: GaiaClientService) : Binder()

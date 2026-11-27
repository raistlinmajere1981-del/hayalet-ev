plugins {
  id("com.android.application")
}

android {
  namespace = "com.hayaletev.gaiaclient"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.hayaletev.gaiaclient"
    minSdk = 28
    targetSdk = 35
    testInstrumentationRunner = "com.hayaletev.gaiaclient.KeystoreProbe"
    versionCode = 1
    versionName = "0.1.0"
  }

  buildTypes {
    debug {
      isDebuggable = true
    }
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

dependencies {
  implementation("com.google.code.gson:gson:2.11.0") { isTransitive = false }
  implementation("org.bouncycastle:bcprov-jdk18on:1.79")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
  testImplementation("junit:junit:4.13.2")
  testImplementation("org.json:json:20240303")
}

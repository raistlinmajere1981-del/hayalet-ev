plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.hayaletev.androidcompanion"
  compileSdk = 35
  ndkVersion = "26.3.11579264"

  defaultConfig {
    applicationId = "com.hayaletev.androidcompanion"
    minSdk = 28
    targetSdk = 35
    versionCode = 2
    versionName = "0.2.0-dev"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    vectorDrawables {
      useSupportLibrary = true
    }

    ndk {
      abiFilters += listOf("armeabi-v7a", "arm64-v8a")
    }

  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    viewBinding = true
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.constraintlayout:constraintlayout:2.1.4")
  implementation("androidx.activity:activity-ktx:1.9.1")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
  implementation("androidx.lifecycle:lifecycle-service:2.8.4")
  implementation("androidx.camera:camera-core:1.4.0-beta02")
  implementation("androidx.camera:camera-camera2:1.4.0-beta02")
  implementation("androidx.camera:camera-lifecycle:1.4.0-beta02")
  implementation("androidx.camera:camera-view:1.4.0-beta02")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.alphacephei:vosk-android:0.3.75")
}

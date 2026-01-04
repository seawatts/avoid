Pod::Spec.new do |s|
  s.name           = 'ExpoUsbMidi'
  s.version        = '0.1.0'
  s.summary        = 'Expo native module for USB MIDI device support using CoreMIDI'
  s.description    = 'An Expo native module that provides USB MIDI device detection and message handling on iOS using the CoreMIDI framework.'
  s.author         = 'seawatts'
  s.homepage       = 'https://github.com/seawatts/startup-template'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { :git => 'https://github.com/seawatts/startup-template.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # CoreMIDI framework for MIDI device communication
  s.frameworks = 'CoreMIDI'

  s.source_files = '**/*.{h,m,mm,swift}'
end

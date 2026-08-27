# 🔐 LockNLeave — Smart IoT-Enabled Railway Luggage Storage System

> Transforming conventional railway luggage storage into a secure, connected and automated smart-storage ecosystem.

## 🚀 Overview

LockNLeave is an IoT-enabled smart locker system designed to provide secure and convenient luggage storage for railway passengers.

The system combines a web-based booking platform, cloud infrastructure, ESP32-powered smart lockers and an administrative monitoring dashboard.

Passengers can:
- View available lockers
- Select a locker and booking duration
- Make a booking
- Receive an assigned PIN
- Authenticate directly at the locker
- Store and retrieve luggage securely

Administrators can:
- Monitor locker availability
- Track active sessions
- Monitor locker and door status
- View usage and revenue information
- Manage locker operations remotely

---

## 🎯 Problem

Railway passengers often face difficulty finding secure and convenient places to store luggage during journeys or while waiting at stations.

Traditional cloakrooms and manual luggage-storage systems can involve:

- Manual registration and management
- Limited visibility of locker availability
- Physical queues
- Lack of real-time monitoring
- Limited automation
- Difficulty scaling across multiple locations
- Security and accountability challenges

LockNLeave addresses these limitations through a connected and centrally managed smart-locker infrastructure.

---

## 💡 Our Solution

LockNLeave connects physical lockers with a cloud-based management platform.

```text
Passenger
    │
    ▼
Web Application
    │
    ▼
Firebase Cloud
    │
    ├──────────────► Admin Dashboard
    │
    ▼
ESP32 Locker Controller
    │
    ├── TFT Display
    ├── Solenoid Lock
    ├── Reed Switch
    ├── Ultrasonic Sensor
    └── Buzzer

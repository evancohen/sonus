CHIP

# Screen
`screen /dev/tty.usbmodem1413 115200`

# Connect to Wifi
sudo nmcli device wifi connect '(your wifi network name/SSID)' password '(your wifi password)' ifname wlan0

# SSH
`sudo ifconfig`
then ssh chip@192.168.1.X

# Install dependencies
```
sudo apt-get update
sudo apt-get install git build-essential libatlas-base-dev sox
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs
```
# Install sonus
See main docs.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/xairline/xa-honeycomb/pkg"
	"io"
	"net/http"
	"os"
	"path"
	"runtime"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type ListResponse struct {
	Data []struct {
		ID         int64  `json:"id"`
		IsWritable bool   `json:"is_writable"`
		Name       string `json:"name"`
		ValueType  string `json:"value_type"`
	} `json:"data"`
}

// App struct
type App struct {
	ctx          context.Context
	profiles     []pkg.Profile
	profileFiles []string
}

// NewApp creates a new App application struct
func NewApp() *App {
	exePath, _ := os.Executable()
	fmt.Println("exePath:", exePath)
	profilesFolder := path.Join(exePath, "..", "..", "..", "..", "profiles")
	if runtime.GOOS != "darwin" {
		profilesFolder = path.Join(exePath, "profiles")
	}
	entries, err := os.ReadDir(profilesFolder)
	if err != nil {
		fmt.Println("Error:", err)
		exePath, _ = os.Getwd()
		profilesFolder = path.Join(exePath, "profiles")
		entries, err = os.ReadDir(profilesFolder)
		if err != nil {
			fmt.Println("Error:", err)
			return nil
		}
	}
	var profiles []pkg.Profile
	var profileFiles []string
	// Loop through the entries
	for _, entry := range entries {
		if !entry.IsDir() && strings.Contains(entry.Name(), ".yaml") { // Skip directories, list only files
			fileName := path.Join(profilesFolder, entry.Name())
			f, err := os.ReadFile(fileName)
			if err != nil {
				fmt.Printf("Error opening file: %v", err)
				return nil
			}
			var res pkg.Profile
			err = yaml.Unmarshal(f, &res)
			if err != nil {
				fmt.Printf("Error reading file: %v", err)
				return nil
			}
			profiles = append(profiles, res)
			profileFiles = append(profileFiles, fileName)
		}
	}
	return &App{
		profiles:     profiles,
		profileFiles: profileFiles,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// GetProfile returns a greeting for the given name
func (a *App) GetProfile(name string) pkg.Profile {
	// get current dir of the app
	for _, profile := range a.profiles {
		if profile.Metadata.Name == name {
			return profile
		}
	}

	return pkg.Profile{}
}

func (a *App) GetProfiles() []pkg.Profile {
	//return "default,A339"
	return a.profiles
}

func (a *App) GetProfileFiles() []string {
	//return "default,A339"
	return a.profileFiles
}

func (a *App) SaveProfileByIndex(index int, profile pkg.Profile) error {
	if index < 0 || index >= len(a.profiles) {
		return errors.New("profile index out of range")
	}

	fileName := a.profileFiles[index]
	output, err := yaml.Marshal(profile)
	if err != nil {
		return err
	}

	err = os.WriteFile(fileName, output, 0o644)
	if err != nil {
		return err
	}

	a.profiles[index] = profile
	return nil
}

func (a *App) GetXplane() []string {
	//GET http://localhost:8086/api/v1/datarefs
	datarefIds := []int64{
		getDatarefId("sim/aircraft/view/acf_ICAO"),
		getDatarefId("sim/aircraft/view/acf_ui_name"),
	}
	res := []string{}
	for _, id := range datarefIds {
		body := getDatarefValue(id)
		res = append(res, body)
	}
	return res
}

func (a *App) GetXplaneDataref(datarefStr string) string {
	id := getDatarefId(datarefStr)
	res := getDatarefValue(id)
	return res
}

func getDatarefId(datarefStr string) int64 {
	// URL for the GET request
	url := fmt.Sprintf("http://localhost:8086/api/v1/datarefs?filter[name]=%s", datarefStr)

	// Create a new HTTP client
	client := &http.Client{Timeout: 2 * time.Second}

	// Create a new GET request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		return 0
	}

	// Set headers if needed
	req.Header.Set("Accept", "application/json")

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error executing request:", err)
		return 0
	}
	defer resp.Body.Close()

	// Check the response status
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Error: Status code %d\n", resp.StatusCode)
		return 0
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return 0
	}

	var response ListResponse
	if err := json.Unmarshal(body, &response); err != nil {
		fmt.Println("Error parsing JSON:", err)
		return 0
	}
	if len(response.Data) == 0 {
		return 0
	}
	return response.Data[0].ID
}

func getDatarefValue(id int64) string {
	if id <= 0 {
		return ""
	}

	// URL for the GET request
	url := fmt.Sprintf("http://localhost:8086/api/v1/datarefs/%d/value", id)

	// Create a new HTTP client
	client := &http.Client{Timeout: 2 * time.Second}

	// Create a new GET request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println("Error creating request:", err)
		return ""
	}

	// Set headers if needed
	req.Header.Set("Accept", "application/json")

	// Execute the request
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error executing request:", err)
		return ""
	}
	defer resp.Body.Close()

	// Check the response status
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Error: Status code %d\n", resp.StatusCode)
		return ""
	}

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return ""
	}

	return string(body)
}

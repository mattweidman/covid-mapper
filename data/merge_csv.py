import csv
import urllib.request as request

# Download data.
def downloadData():
    print("downloading covid_confirmed_usafacts.csv")
    request.urlretrieve('https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_confirmed_usafacts.csv', 'covid_confirmed_usafacts.csv')
    print("downloading covid_deaths_usafacts.csv")
    request.urlretrieve('https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_deaths_usafacts.csv', 'covid_deaths_usafacts.csv')
    print("downloading covid_county_population_usafacts.csv")
    request.urlretrieve('https://usafactsstatic.blob.core.windows.net/public/data/covid-19/covid_county_population_usafacts.csv', 'covid_county_population_usafacts.csv')

# Create a row of data containing info about confirmed cases, deaths, and population.
def processRow(confirmedRow, populationRow, deathsRow, isTopRow):
    countyFIPS = confirmedRow[0]
    countyName = confirmedRow[1]
    state = confirmedRow[2]
    stateFIPS = confirmedRow[3]
    population = populationRow[3]
    singleStats = [countyFIPS, countyName, state, stateFIPS, population]

    if isTopRow:
        dates = confirmedRow[4:]
        confirmedCases = list(map(lambda x: "confirmed_" + x, dates))
        deaths = list(map(lambda x: "deaths_" + x, dates))
        newCases = list(map(lambda x: "newconfirmed_" + x, dates))
        newDeaths = list(map(lambda x: "newdeaths_" + x, dates))
    else:
        confirmedCases = confirmedRow[4:]
        deaths = deathsRow[4:]
        newCases = []
        newDeaths = []
        for i in range(0, len(confirmedCases)):
            if i == 0:
                newCases.append(confirmedCases[0])
                newDeaths.append(deaths[0])
            else:
                newCases.append(int(confirmedCases[i]) - int(confirmedCases[i - 1]))
                newDeaths.append(int(deaths[i]) - int(deaths[i - 1]))

    return singleStats + confirmedCases + deaths + newCases + newDeaths

downloadData()

with open('covid_confirmed_usafacts.csv') as confirmedFile:
    with open('covid_county_population_usafacts.csv') as populationFile:
        with open('covid_deaths_usafacts.csv') as deathsFile:
            with open('covid_all.csv', 'w', newline='') as allDataFile:

                confirmedReader = csv.reader(confirmedFile)
                populationReader = csv.reader(populationFile)
                deathsReader = csv.reader(deathsFile)
                allDataWriter = csv.writer(allDataFile)

                print("merging CSVs")

                try:
                    confirmedRow = confirmedReader.__next__()
                    populationRow = populationReader.__next__()
                    deathsRow = deathsReader.__next__()
                    allDataWriter.writerow(processRow(confirmedRow, populationRow, deathsRow, True))
                    
                    while (True):
                        confirmedRow = confirmedReader.__next__()
                        populationRow = populationReader.__next__()
                        deathsRow = deathsReader.__next__()
                        allDataWriter.writerow(processRow(confirmedRow, populationRow, deathsRow, False))
                
                except StopIteration:
                    print("CSV processing complete.")
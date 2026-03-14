Feature: Login via mock web app
  As an automation engineer
  I want to validate the login flow with business-readable scenarios
  So that BDD suites remain aligned with product behavior

  Scenario: Standard user signs in successfully
    Given the local mock services are running
    When the standard user logs in through the login page
    Then the welcome message should be "Welcome, standard_user"
